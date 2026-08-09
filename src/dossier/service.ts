/**
 * Cache-first dossier orchestration.
 *
 * The law: a fresh deep-research run costs ~$0.50, a cached read costs nothing.
 * So no user action may trigger a swarm when a usable cache entry exists.
 *
 *   fresh  -> serve, done.
 *   stale  -> serve immediately, refresh in the background, swap silently.
 *   none   -> this is the ONLY case where the user sees the live glass engine.
 *
 * Health is refreshed on its own clock, because a new inspection matters even
 * when the prose is still current — and re-checking it costs one HTTP call
 * rather than a whole swarm.
 */
import { db } from "../db";
import { lookupHealth } from "../health";
import { runSwarm, synthesisInput } from "../swarm/runSwarm";
import { initialState, reducer } from "../swarm/reducer";
import { completeStream, parseJSON } from "../api/claude";
import { SYNTHESIZE_PROMPT } from "../prompts";
import type { DossierRow, EvidenceRow, Health, Restaurant } from "../db/types";
import type { Analysis, SwarmEvent } from "../types";

const DAY = 24 * 60 * 60 * 1000;
const POPULAR_TTL = 7 * DAY;
const QUIET_TTL = 30 * DAY;
const HEALTH_TTL = 30 * DAY;
const POPULAR_VIEWS = 3;

export function isFresh(d: DossierRow | null): boolean {
  if (!d || d.status === "failed" || !d.verdict) return false;
  if (!d.refresh_after) return false;
  return Date.now() < Date.parse(d.refresh_after);
}

function ttlFor(views: number): number {
  return views >= POPULAR_VIEWS ? POPULAR_TTL : QUIET_TTL;
}

/** Health has its own clock so a new inspection surfaces without a full run. */
export async function refreshHealthIfDue(
  r: Restaurant,
  d: DossierRow,
): Promise<Health | null> {
  const due =
    !d.health_checked_at || Date.now() - Date.parse(d.health_checked_at) > HEALTH_TTL;
  if (!due) return null;
  const health = await lookupHealth({
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    city: r.city,
  });
  await db.saveDossier({
    restaurant_id: r.id,
    health,
    health_checked_at: new Date().toISOString(),
  });
  return health;
}

export interface RunHandle {
  /** Live swarm events, for the glass engine. Never fires on a cache hit. */
  onEvent?: (e: SwarmEvent) => void;
  onNarration?: (chunk: string) => void;
  signal?: AbortSignal;
}

/** Full research run → persisted dossier. Only called on a cache miss. */
export async function buildDossier(
  r: Restaurant,
  h: RunHandle = {},
): Promise<DossierRow> {
  let state = initialState(r.name, r.city ?? "");
  const dispatch = (e: SwarmEvent) => {
    state = reducer(state, e);
    h.onEvent?.(e);
  };

  await db.saveDossier({ restaurant_id: r.id, status: "running" });

  // The swarm and the health lookup are independent — run them together.
  const [, health] = await Promise.all([
    runSwarm({
      name: r.name,
      city: r.city ?? "",
      dispatch,
      signal: h.signal,
      tier2: true,
    }),
    lookupHealth({ name: r.name, lat: r.lat, lng: r.lng, city: r.city }),
  ]);

  dispatch({ type: "synthesis/start" });
  const raw = await completeStream(
    SYNTHESIZE_PROMPT(synthesisInput(state)),
    (t) => {
      dispatch({ type: "synthesis/token", text: t });
      h.onNarration?.(t);
    },
    8000,
    h.signal,
  );
  const analysis = parseJSON<Analysis>(raw);
  dispatch({ type: "synthesis/done", analysis });

  // One flat, attributed corpus. Excerpts stay short: they are quotes, not
  // content — that is both the legal posture and the reason chat stays honest.
  const evidence: EvidenceRow[] = [
    ...state.reviews.map((rv) => ({
      text: clip(rv.text),
      source: rv.source,
      url: rv.url ?? null,
      date: rv.date ?? null,
      kind: "review" as const,
    })),
    ...Object.entries(state.findings).flatMap(([agent, list]) =>
      list.map((f) => ({
        text: clip(f.quote ?? f.finding),
        source: f.source,
        url: f.url ?? null,
        date: f.date ?? null,
        kind: (agent === "press" ? "press" : agent === "pulse" ? "news" : "press") as
          | "press"
          | "news",
      })),
    ),
    ...(state.social?.mentions ?? []).map((m) => ({
      text: clip(m.quote ?? m.gist),
      source: m.platform,
      url: m.url ?? null,
      date: null,
      kind: "social" as const,
    })),
  ].filter((e) => e.text.trim().length > 0);

  const sources = [...new Set(evidence.map((e) => e.source).filter(Boolean))];
  const views = 0;

  return db.saveDossier({
    restaurant_id: r.id,
    status: "fresh",
    verdict: analysis.verdict,
    badges: analysis.badges ?? [],
    vitals: analysis.vitals ?? null,
    patterns: analysis.patterns ?? [],
    diner_view: analysis.diner_view ?? null,
    key_reviews: analysis.key_reviews ?? [],
    bright_spots: analysis.bright_spots ?? [],
    social_pulse: state.social,
    health,
    evidence,
    sources,
    evidence_count: evidence.length,
    generated_at: new Date().toISOString(),
    refresh_after: new Date(Date.now() + ttlFor(views)).toISOString(),
    health_checked_at: new Date().toISOString(),
  });
}

/** ≤ ~40 words per excerpt: short, attributed, quotable — never republished. */
function clip(text: string, words = 40): string {
  const parts = text.trim().split(/\s+/);
  return parts.length <= words ? text.trim() : `${parts.slice(0, words).join(" ")}…`;
}

export interface DossierResult {
  dossier: DossierRow | null;
  /** True when the caller must show the live engine — no cache existed. */
  cold: boolean;
  /** Resolves when a background refresh finishes, if one was started. */
  refreshing?: Promise<DossierRow | void>;
}

export async function getDossier(
  r: Restaurant,
  h: RunHandle = {},
): Promise<DossierResult> {
  const existing = await db.dossierFor(r.id);
  void db.bumpView(r.id);

  if (existing && isFresh(existing)) {
    // Cheap, independent: a new inspection should not wait on the prose TTL.
    void refreshHealthIfDue(r, existing);
    return { dossier: existing, cold: false };
  }

  if (existing && existing.verdict) {
    // Stale but usable — serve now, refresh behind the user's back.
    const refreshing = buildDossier(r, { signal: h.signal }).catch(() => {});
    return { dossier: existing, cold: false, refreshing };
  }

  return { dossier: null, cold: true };
}
