/**
 * Health-inspection lookup: route a restaurant to the right city's open-data
 * adapter, or refuse.
 *
 * The refusal path matters more than the happy path. If we cannot resolve a
 * city, or the best candidate is not confidently the same business, we return
 * `no_confident_match` and the UI omits the section entirely. We never fall
 * back to "close enough" and we never return another city's data.
 */

import type { Health } from "../db/types.ts";
import { CONFIDENCE_THRESHOLD, matchConfidence, searchTokens } from "./match.ts";

export type City = "sf" | "nyc";

export interface HealthLookupArgs {
  name: string;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  signal?: AbortSignal;
}

export const NO_MATCH: Health = { status: "no_confident_match" };

// ---------------------------------------------------------------------------
// City resolution
// ---------------------------------------------------------------------------

const CITY_ALIASES: Array<[RegExp, City]> = [
  [/\b(?:san\s*francisco|s\.?\s?f\.?|sfo)\b/, "sf"],
  [
    /\b(?:new\s*york(?:\s*city)?|nyc|n\.?\s?y\.?\s?c\.?|manhattan|brooklyn|queens|bronx|staten\s*island)\b/,
    "nyc",
  ],
];

/** Generous metro boxes — only used when the city string is missing or unknown. */
const CITY_BOXES: Array<{ city: City; minLat: number; maxLat: number; minLng: number; maxLng: number }> = [
  { city: "sf", minLat: 37.7, maxLat: 37.84, minLng: -122.55, maxLng: -122.34 },
  { city: "nyc", minLat: 40.47, maxLat: 40.93, minLng: -74.28, maxLng: -73.68 },
];

/**
 * Resolve which adapter (if any) covers this location: city string first, then
 * a coordinate bounding box. Returns null when we have no data source — the
 * caller must then refuse rather than reach for a neighbouring city.
 */
export function cityFor(city?: string | null, lat?: number | null, lng?: number | null): City | null {
  if (city) {
    const s = city.toLowerCase();
    for (const [re, resolved] of CITY_ALIASES) if (re.test(s)) return resolved;
  }
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const la = lat as number;
    const ln = lng as number;
    for (const box of CITY_BOXES) {
      if (la >= box.minLat && la <= box.maxLat && ln >= box.minLng && ln <= box.maxLng) return box.city;
    }
  }
  return null;
}

export async function lookupHealth(
  args: HealthLookupArgs & { city?: string | null },
): Promise<Health> {
  const city = cityFor(args.city, args.lat, args.lng);
  if (!city) return NO_MATCH;
  try {
    // Dynamic import keeps index <- adapter <- index from becoming a cycle and
    // lets the bundler split the two adapters.
    const mod = city === "sf" ? await import("./sf.ts") : await import("./nyc.ts");
    return await mod.lookup(args);
  } catch {
    return NO_MATCH;
  }
}

// ---------------------------------------------------------------------------
// Shared Socrata plumbing (used by ./sf.ts and ./nyc.ts)
// ---------------------------------------------------------------------------

export type Row = Record<string, unknown>;

/** Safe string read — Socrata returns every scalar as a string, or omits it. */
export function str(row: Row, field: string): string {
  const v = row[field];
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

export function num(row: Row, field: string): number | null {
  const v = str(row, field);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** ISO date part of a Socrata floating timestamp ("2019-03-22T00:00:00.000"). */
export function isoDate(row: Row, field: string): string {
  return str(row, field).slice(0, 10);
}

/** Escape a value for a SoQL single-quoted string literal. */
const soqlLiteral = (v: string): string => `'${v.replace(/'/g, "''")}'`;

/** Only letters and digits survive, so `%` / `_` can never leak into a LIKE. */
const likePattern = (token: string): string => `'%${token.replace(/[^A-Z0-9]/g, "")}%'`;

/**
 * Describes one city's dataset. Both adapters run the identical two-phase
 * algorithm; only the field names and the row -> Health projection differ.
 */
export interface DatasetSpec {
  /** Socrata JSON endpoint. */
  endpoint: string;
  /** Human-readable attribution stored on the Health row. */
  source: string;
  /** Dataset landing page. */
  datasetUrl: string;
  /** Stable per-business identifier (SF `business_id`, NYC `camis`). */
  idField: string;
  nameField: string;
  latField: string;
  lngField: string;
  /** Socrata "point" column used by `within_circle`. */
  locField: string;
  dateField: string;
  /** Extra columns to carry through phase 1 (kept in the GROUP BY). */
  extraGroupFields: string[];
  /** Turn every inspection row for the winning business into the Health payload. */
  project(rows: Row[]): {
    grade: string | null;
    score: number | null;
    inspected_at: string | null;
    critical_violations: string[];
  };
}

async function getRows(endpoint: string, params: URLSearchParams, signal?: AbortSignal): Promise<Row[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  const relay = () => controller.abort();
  signal?.addEventListener("abort", relay, { once: true });
  try {
    const res = await fetch(`${endpoint}?${params.toString()}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return [];
    const body: unknown = await res.json();
    return Array.isArray(body) ? (body as Row[]) : [];
  } catch {
    // Offline, rate-limited, aborted, malformed JSON — all mean "we don't know".
    return [];
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", relay);
  }
}

/**
 * Two-phase lookup.
 *
 * Phase 1 collapses the dataset to one row per business with `$group`, so a
 * dense block of Manhattan comes back as ~150 rows instead of thousands. Every
 * candidate is scored; only the winner survives.
 *
 * Phase 2 pulls that one business's full inspection history and projects it.
 */
export async function runLookup(spec: DatasetSpec, args: HealthLookupArgs): Promise<Health> {
  const name = args.name?.trim();
  if (!name) return NO_MATCH;

  const hasCoords = Number.isFinite(args.lat) && Number.isFinite(args.lng);
  const lat = hasCoords ? (args.lat as number) : null;
  const lng = hasCoords ? (args.lng as number) : null;

  const clauses: string[] = [];
  // 250m is the distance past which matchConfidence hard-ceilings below the
  // threshold, so fetching a wider circle would only add rows that can't win.
  if (lat !== null && lng !== null) {
    clauses.push(`within_circle(${spec.locField}, ${lat}, ${lng}, 250)`);
  }
  // Name clause catches records that carry no coordinates at all (common in SF).
  const token = searchTokens(name)[0];
  if (token) clauses.push(`upper(${spec.nameField}) like ${likePattern(token)}`);
  if (!clauses.length) return NO_MATCH;

  const groupFields = [
    spec.idField,
    spec.nameField,
    spec.latField,
    spec.lngField,
    ...spec.extraGroupFields,
  ];

  const phase1 = new URLSearchParams();
  phase1.set("$select", groupFields.join(","));
  phase1.set("$group", groupFields.join(","));
  phase1.set("$where", clauses.join(" OR "));
  phase1.set("$limit", "2000");

  const candidates = await getRows(spec.endpoint, phase1, args.signal);
  if (!candidates.length) return NO_MATCH;

  const queryCoords = lat !== null && lng !== null ? { lat, lng } : null;
  let bestId = "";
  let bestConfidence = 0;
  for (const row of candidates) {
    const id = str(row, spec.idField);
    if (!id) continue;
    const cLat = num(row, spec.latField);
    const cLng = num(row, spec.lngField);
    const confidence = matchConfidence({
      queryName: name,
      candidateName: str(row, spec.nameField),
      queryCoords,
      candidateCoords: cLat !== null && cLng !== null ? { lat: cLat, lng: cLng } : null,
    });
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestId = id;
    }
  }

  if (!bestId || bestConfidence < CONFIDENCE_THRESHOLD) return NO_MATCH;

  const phase2 = new URLSearchParams();
  phase2.set("$where", `${spec.idField} = ${soqlLiteral(bestId)}`);
  phase2.set("$order", `${spec.dateField} DESC`);
  phase2.set("$limit", "400");

  const history = await getRows(spec.endpoint, phase2, args.signal);
  if (!history.length) return NO_MATCH;

  const projected = spec.project(history);
  return {
    status: "matched",
    ...projected,
    match_confidence: Math.round(bestConfidence * 100) / 100,
    source: spec.source,
    url: spec.datasetUrl,
  };
}

/**
 * The inspection we report on. Prefer the most recent one that actually carries
 * a score — the newest record is often a complaint visit or re-inspection with
 * no score and no findings, and reporting that would blank out real data.
 * Grade, score, date and violations then all describe that single visit.
 */
export function reportedInspection(
  rows: Row[],
  dateField: string,
  hasScore: (row: Row) => boolean,
): { date: string; rows: Row[] } | null {
  const byDate = new Map<string, Row[]>();
  for (const row of rows) {
    const d = isoDate(row, dateField);
    // NYC uses 1900-01-01 as a "never inspected" placeholder.
    if (!d || d.startsWith("1900")) continue;
    const bucket = byDate.get(d);
    if (bucket) bucket.push(row);
    else byDate.set(d, [row]);
  }
  if (!byDate.size) return null;

  const dates = [...byDate.keys()].sort().reverse();
  const scored = dates.find((d) => (byDate.get(d) as Row[]).some(hasScore));
  const date = scored ?? dates[0];
  return { date, rows: byDate.get(date) as Row[] };
}

/** Sentence-case, single-line, at most 12 words. */
export function tidySummary(text: string): string {
  const words = text.replace(/\s+/g, " ").trim().replace(/[.;:]+$/, "").split(" ");
  const clipped = words.length > 12 ? `${words.slice(0, 12).join(" ")}…` : words.join(" ");
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}

/** De-duplicate, sort worst-first, keep at most three. */
export function topCriticals(items: Array<{ text: string; severity: number }>): string[] {
  const seen = new Set<string>();
  return items
    .slice()
    .sort((a, b) => a.severity - b.severity)
    .filter((i) => {
      const k = i.text.toLowerCase();
      if (!i.text || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 3)
    .map((i) => i.text);
}
