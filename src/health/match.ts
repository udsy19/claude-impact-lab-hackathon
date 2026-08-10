/**
 * Pure, network-free scoring for "is this open-data inspection record actually
 * the restaurant the user is looking at?".
 *
 * Showing the wrong restaurant's violations is the worst error this product can
 * make, so every rule here is biased toward refusing rather than guessing.
 */

import { haversineMiles, type LatLng } from "../lib/geo.ts";

/**
 * Accept only at or above this. Calibrated against the bands the scorer can
 * actually produce:
 *
 *   ~1.00  exact normalised name, same address (<=50m)
 *   ~0.95  query name is a clean prefix/subset of the record name, <=50m
 *   ~0.88  exact name but no coordinates on either side (unverifiable)
 *   ~0.80  exact name, we have coords but the record does not
 *   <=0.65 hard ceiling for an entirely generic query name ("Kitchen")
 *   <=0.60 hard ceiling once the two points are more than 250m apart
 *
 * 0.72 sits in the empty gap between the highest "must refuse" band (0.65) and
 * the lowest "safe to show" band (~0.80), so no single weak signal — a good
 * name at the wrong address, or a generic name at the right one — can push a
 * wrong record over the line. Both have to be right.
 */
export const CONFIDENCE_THRESHOLD = 0.72;

/** Corporate/filler words that carry no identifying information. */
const NOISE_TOKENS = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "at",
  "on",
  "restaurant",
  "restaurants",
  "restaurante",
  "cafe",
  "inc",
  "incorporated",
  "llc",
  "llp",
  "lp",
  "ltd",
  "co",
  "corp",
  "corporation",
  "company",
  "dba",
]);

/**
 * Words so common in restaurant names that on their own they identify nothing.
 * A query built only from these can never clear the threshold.
 */
const GENERIC_TOKENS = new Set([
  "kitchen",
  "food",
  "foods",
  "eatery",
  "eats",
  "dining",
  "diner",
  "bistro",
  "grill",
  "grille",
  "bar",
  "pub",
  "tavern",
  "lounge",
  "club",
  "house",
  "garden",
  "gardens",
  "place",
  "spot",
  "room",
  "corner",
  "station",
  "shop",
  "store",
  "stand",
  "truck",
  "cart",
  "market",
  "grocery",
  "deli",
  "bakery",
  "cuisine",
  "gourmet",
  "buffet",
  "catering",
  "express",
  "thai",
  "chinese",
  "china",
  "mexican",
  "italian",
  "indian",
  "japanese",
  "korean",
  "american",
  "asian",
  "mediterranean",
  "pizza",
  "pizzeria",
  "sushi",
  "burger",
  "burgers",
  "sandwich",
  "sandwiches",
  "chicken",
  "steak",
  "steakhouse",
  "seafood",
  "noodle",
  "noodles",
  "ramen",
  "bbq",
  "barbecue",
  "coffee",
  "tea",
  "juice",
  "bagel",
  "bowl",
  "wok",
]);

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * lowercase, de-accent, drop apostrophes (so "Katz's" -> "katzs"), collapse all
 * other punctuation to spaces, and strip a trailing store number ("#2", "no 3").
 */
function normalizeName(raw: string): string {
  // Decided on the RAW string: the character class below destroys "#".
  const hasBranchMarker = /#\s*\d+\s*$/.test(raw);

  let s = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  /*
   * Only strip a trailing number when something marks it as a BRANCH number:
   * "#2", "no. 2", "store 4". An earlier version made that prefix optional,
   * which stripped EVERY trailing numeral — so "Cafe 1951" and "Cafe 2020"
   * both normalised to "cafe", scored 1.00, and at a shared address produced a
   * confident match on the wrong restaurant. For a health-inspection record
   * that is the worst failure this module can produce, so a number now stays
   * unless it is explicitly marked as a branch.
   */
  const stripped = hasBranchMarker
    ? s.replace(/\s*\d+\s*$/, "").trim()
    : s.replace(/\s+(?:no|num|number|store|unit|ste|suite)\s*\d+\s*$/, "").trim();
  if (stripped) s = stripped;
  return s;
}

/** Tokens with the noise words removed — unless that would empty the name. */
function contentTokens(normalized: string): string[] {
  if (!normalized) return [];
  const all = normalized.split(" ").filter(Boolean);
  const kept = all.filter((t) => !NOISE_TOKENS.has(t));
  return kept.length ? kept : all;
}

function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (!sa.size || !sb.size) return 0;
  let shared = 0;
  for (const t of sa) if (sb.has(t)) shared += 1;
  return shared / (sa.size + sb.size - shared);
}

/** Sørensen–Dice over character bigrams. Robust to word order and typos. */
function diceBigrams(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const counts = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i += 1) {
    const g = a.slice(i, i + 2);
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  let shared = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const g = b.slice(i, i + 2);
    const left = counts.get(g) ?? 0;
    if (left > 0) {
      counts.set(g, left - 1);
      shared += 1;
    }
  }
  return (2 * shared) / (a.length - 1 + (b.length - 1));
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length];
}

function levSimilarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (!longest) return 0;
  return 1 - levenshtein(a, b) / longest;
}

/**
 * 0..1 similarity between two restaurant names, blending token-set overlap
 * (word order / extra words), Dice bigrams (typos, spelling variants) and
 * normalised Levenshtein (whole-string shape), plus a containment rule so
 * "Peter Luger" still scores well against "Peter Luger Steakhouse".
 */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ta = contentTokens(na);
  const tb = contentTokens(nb);
  const ja = ta.join(" ");
  const jb = tb.join(" ");
  if (ja && ja === jb) return 1;

  const blended =
    0.4 * jaccard(ta, tb) + 0.35 * diceBigrams(ja, jb) + 0.25 * levSimilarity(ja, jb);

  // One name's words are entirely contained in the other's. How much of the
  // longer name is covered decides how strong that signal is.
  const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const contained = small.length > 0 && small.every((t) => big.includes(t));
  const containment = contained ? 0.7 + 0.3 * (small.length / big.length) : 0;

  return clamp01(Math.max(blended, containment));
}

/**
 * Uppercase alphanumeric chunks of a name, most distinctive first, for building
 * a Socrata `like` filter. Split happens *before* apostrophes are dropped, so
 * "Katz's Delicatessen" yields DELICATESSEN/KATZ — both of which really do
 * appear inside the stored value "KATZ'S DELICATESSEN".
 */
export function searchTokens(name: string): string[] {
  const chunks = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .map((c) => c.toLowerCase())
    .filter((c) => c.length >= 3 && !NOISE_TOKENS.has(c));
  const distinctive = chunks.filter((c) => !GENERIC_TOKENS.has(c));
  const pool = distinctive.length ? distinctive : chunks;
  return [...new Set(pool)].sort((a, b) => b.length - a.length).map((c) => c.toUpperCase());
}

/**
 * Great-circle metres, reusing the shared `haversineMiles`. Unusable input
 * returns Infinity there, which lands in the "far away, refuse" band — the
 * safe direction.
 */
const METRES_PER_MILE = 1609.344;
const distanceMeters = (a: LatLng, b: LatLng): number => haversineMiles(a, b) * METRES_PER_MILE;

const isUsableCoord = (c?: { lat: number; lng: number } | null): c is { lat: number; lng: number } =>
  !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng) && (c.lat !== 0 || c.lng !== 0);

/**
 * Overall 0..1 confidence that `candidateName`/`candidateCoords` is the same
 * business as `queryName`/`queryCoords`.
 *
 * Distance is a gate, not a tiebreak: past 250m the result is hard-ceilinged
 * below the threshold no matter how perfect the name is.
 */
export function matchConfidence(args: {
  queryName: string;
  candidateName: string;
  queryCoords?: { lat: number; lng: number } | null;
  candidateCoords?: { lat: number; lng: number } | null;
}): number {
  const name = nameSimilarity(args.queryName, args.candidateName);
  if (name <= 0) return 0;

  let conf = name;
  let ceiling = 1;

  // --- generic / too-short query name ------------------------------------
  const qTokens = contentTokens(normalizeName(args.queryName));
  const distinctive = qTokens.filter((t) => t.length >= 3 && !GENERIC_TOKENS.has(t));
  if (distinctive.length === 0) {
    // "Kitchen", "Thai Food", "The Restaurant" — identifies nothing. Never accept.
    ceiling = Math.min(ceiling, 0.65);
  } else if (distinctive.join("").length < 4) {
    ceiling = Math.min(ceiling, 0.7);
  }

  // --- distance gate ------------------------------------------------------
  const qc = isUsableCoord(args.queryCoords) ? args.queryCoords : null;
  const cc = isUsableCoord(args.candidateCoords) ? args.candidateCoords : null;

  if (qc && cc) {
    const d = distanceMeters(qc, cc);
    if (d <= 50) {
      conf = conf + 0.08; // same address: real corroboration
    } else if (d <= 120) {
      conf = conf * 0.99 + 0.03;
    } else if (d <= 250) {
      conf = conf * 0.92;
      ceiling = Math.min(ceiling, 0.95);
    } else if (d <= 600) {
      conf = conf * 0.62;
      ceiling = Math.min(ceiling, 0.6);
    } else if (d <= 2000) {
      conf = conf * 0.4;
      ceiling = Math.min(ceiling, 0.4);
    } else {
      conf = conf * 0.15;
      ceiling = Math.min(ceiling, 0.2);
    }
  } else if (qc && !cc) {
    // We know where the user is but the record has no coordinates: the name has
    // to carry the whole match, so it must be near-exact to survive.
    conf = conf * 0.8;
    ceiling = Math.min(ceiling, 0.85);
  } else {
    // No coordinates at all — nothing to corroborate the name with.
    conf = conf * 0.88;
    ceiling = Math.min(ceiling, 0.9);
  }

  return clamp01(Math.min(conf, ceiling));
}
