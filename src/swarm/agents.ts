/**
 * The seven agents. Each one is an async function over an AgentCtx that emits
 * SwarmEvents and never throws past its own boundary — one dead agent must
 * never take the swarm down with it.
 *
 * Field notes that shaped this file (validated live against Tavily):
 *  - /extract 403s on yelp.com, so every Yelp read goes through /search with
 *    include_raw_content.
 *  - yelp.com/biz/<slug> is chrome. yelp.com/menu/<slug>/item/<dish> carries
 *    40-70 verbatim customer passages. Landing those pages is REVIEWS' job,
 *    which is why the pool is sorted to put menu-item URLs first before the
 *    passage cap is applied.
 *  - include_domains is a soft filter; off-list domains come back and are often
 *    the best material. We never discard on domain.
 */

import { completeJSON } from "../api/claude";
import {
  hostOf,
  looksLikeReview,
  passages,
  search,
  searchWithImages,
  type TavilyResult,
  yelpSlug,
} from "../api/tavily";
import {
  CONTEXT_EXTRACT_PROMPT,
  FINDINGS_EXTRACT_PROMPT,
  PRESS_LENS,
  PULSE_LENS,
  REVIEW_EXTRACT_PROMPT,
  SOCIAL_EXTRACT_PROMPT,
} from "../prompts";
import { DOMAINS, FALLBACK_STATS, QUERIES } from "../sources";
import type {
  AgentId,
  AgentStatus,
  ContextStat,
  EvidenceItem,
  Finding,
  ParsedReview,
  SocialPulse,
  SwarmEvent,
} from "../types";

export interface AgentCtx {
  name: string;
  city: string;
  dispatch: (e: SwarmEvent) => void;
  signal: AbortSignal;
  t: () => number; // ms since swarm start
}

// ---------- payload budgets ----------

const REVIEW_MAX_PASSAGES = 90;
/** Passages per concurrent extraction call — see the note in reviewsAgent. */
const REVIEW_CHUNK = 30;
const FINDING_MAX_PASSAGES = 60;
const SOCIAL_MAX_BLOCKS = 50;
const CONTEXT_MAX_PASSAGES = 30;
const PASSAGE_CHARS = 700;
const SOCIAL_CHARS = 500;
/** Passage-level dedupe window. Yelp repeats the same review across pages. */
const PASSAGE_KEY_CHARS = 80;
const EVIDENCE_BATCH = 40;

// ---------- tiny shared helpers ----------

function status(ctx: AgentCtx, id: AgentId, s: AgentStatus, line: string): void {
  ctx.dispatch({ type: "agent/status", id, status: s, line, t: ctx.t() });
}

function note(ctx: AgentCtx, id: AgentId, domain: string): void {
  if (domain && domain !== "unknown") ctx.dispatch({ type: "agent/domain", id, domain });
}

function done(ctx: AgentCtx, id: AgentId, count: number): void {
  ctx.dispatch({ type: "agent/done", id, count, t: ctx.t() });
}

function message(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return "Stopped early — partial results kept.";
  }
  if (err instanceof Error) return err.message;
  return String(err ?? "Unknown error");
}

/** Every agent body runs inside this. A throw becomes agent/failed, never a rethrow. */
async function guard(
  ctx: AgentCtx,
  id: AgentId,
  body: () => Promise<void>,
): Promise<void> {
  try {
    await body();
  } catch (err) {
    ctx.dispatch({ type: "agent/failed", id, error: message(err), t: ctx.t() });
  }
}

let seq = 0;
function evidenceId(id: AgentId): string {
  seq += 1;
  return `${id}-${seq.toString(36)}`;
}

const todayISO = (): string => new Date().toISOString().slice(0, 10);

function clip(s: string, n: number): string {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

interface Probe {
  query: string;
  domains?: readonly string[];
  maxResults?: number;
}

interface GatherOpts {
  /** Flip include_images on these probes and dispatch whatever rides back. */
  images?: boolean;
}

/** Images are cosmetic — a bad dispatch must never break the agent around it. */
function emitImages(ctx: AgentCtx, urls: string[]): void {
  if (!urls.length) return;
  try {
    ctx.dispatch({ type: "images/collected", urls });
  } catch {
    /* ignore — the brief renders fine without a photo strip */
  }
}

/**
 * Fire probes concurrently, keep whatever lands, and report every domain seen.
 * Only throws if EVERY probe failed — that means the key or network is broken,
 * which the operator should see rather than a silent empty agent.
 *
 * With `images`, the SAME probes carry include_images — no extra round trips.
 */
async function gather(
  ctx: AgentCtx,
  id: AgentId,
  probes: Probe[],
  { images = false }: GatherOpts = {},
): Promise<TavilyResult[]> {
  const settled = await Promise.allSettled(
    probes.map((p) => {
      const opts = {
        domains: p.domains,
        maxResults: p.maxResults ?? 8,
        raw: true,
        signal: ctx.signal,
      };
      return images
        ? searchWithImages(p.query, opts)
        : search(p.query, opts).then((results) => ({ results, images: [] as string[] }));
    }),
  );
  const results: TavilyResult[] = [];
  const photos: string[] = [];
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    results.push(...s.value.results);
    photos.push(...s.value.images);
  }

  if (!results.length) {
    const failure = settled.find((s) => s.status === "rejected");
    if (failure && failure.status === "rejected") throw failure.reason;
  }

  emitImages(ctx, photos);
  for (const r of results) note(ctx, id, hostOf(r.url));
  return results;
}

/**
 * One extra image-only search, used by the orchestrator when the main sweep
 * produced no photos at all. Cheap (no raw content) and never throws.
 */
export async function photoTopUp(ctx: AgentCtx): Promise<void> {
  try {
    const { images } = await searchWithImages(QUERIES(ctx.name, ctx.city).photos[0], {
      maxResults: 8,
      raw: false,
      signal: ctx.signal,
    });
    emitImages(ctx, images);
  } catch {
    /* cosmetic — a failed photo probe is not a swarm failure */
  }
}

interface Tagged {
  domain: string;
  text: string;
}

interface HarvestOpts {
  reviewsOnly?: boolean;
  maxPassages: number;
  maxChars: number;
}

/** Raw page dumps -> deduped, capped, domain-tagged prose passages. */
function harvest(
  results: TavilyResult[],
  { reviewsOnly = false, maxPassages, maxChars }: HarvestOpts,
): Tagged[] {
  const seen = new Set<string>();
  const out: Tagged[] = [];
  for (const r of results) {
    const domain = hostOf(r.url);
    for (const p of passages(r.raw_content)) {
      if (reviewsOnly && !looksLikeReview(p)) continue;
      const key = p.toLowerCase().replace(/\s+/g, " ").trim().slice(0, PASSAGE_KEY_CHARS);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ domain, text: clip(p, maxChars) });
      if (out.length >= maxPassages) return out;
    }
  }
  return out;
}

function toBlocks(items: Tagged[]): string {
  return items.map((i) => `[${i.domain}] ${i.text}`).join("\n\n");
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Shared tail for every findings-shaped agent (press, pulse, menu, inspector). */
async function extractFindings(
  ctx: AgentCtx,
  id: AgentId,
  lens: string,
  items: Tagged[],
  maxTokens = 8000,
): Promise<Finding[]> {
  if (!items.length) return [];
  status(ctx, id, "extracting", `Reading ${items.length} passages`);
  const raw = await completeJSON<Finding[]>(
    FINDINGS_EXTRACT_PROMPT(ctx.name, ctx.city, lens, toBlocks(items), todayISO()),
    maxTokens,
    ctx.signal,
  );
  return asArray<Finding>(raw).filter((f) => f && typeof f.finding === "string" && f.finding.trim());
}

function findingEvidence(id: AgentId, findings: Finding[]): EvidenceItem[] {
  return findings.slice(0, EVIDENCE_BATCH).map((f) => ({
    id: evidenceId(id),
    kind: "finding" as const,
    text: f.quote?.trim() || f.finding,
    source: f.source || "unknown",
    date: f.date ?? null,
    agent: id,
  }));
}

function emitFindings(ctx: AgentCtx, id: AgentId, findings: Finding[]): void {
  ctx.dispatch({ type: "findings/collected", agent: id, findings });
  ctx.dispatch({ type: "agent/evidence", id, items: findingEvidence(id, findings) });
}

// ---------- REVIEWS ----------

/** Yelp menu-item pages are the goldmine; make sure they survive the cap. */
function reviewPriority(url: string): number {
  if (/yelp\.com\/menu\/[^/]+\/item\//i.test(url)) return 0;
  if (/yelp\.com\/menu\//i.test(url)) return 1;
  return 2;
}

export async function reviewsAgent(ctx: AgentCtx): Promise<void> {
  const id: AgentId = "reviews";
  await guard(ctx, id, async () => {
    const Q = QUERIES(ctx.name, ctx.city);

    status(ctx, id, "searching", "Locating the Yelp listing");
    const located = await gather(ctx, id, [
      { query: Q.locate[0], domains: ["yelp.com"], maxResults: 8 },
    ]);
    const slug = yelpSlug(located);

    status(
      ctx,
      id,
      "reading",
      slug ? `Found /${slug} — pulling menu-item review pages` : "Pulling review pages",
    );

    const probes: Probe[] = [
      { query: Q.reviews[0], domains: ["yelp.com"], maxResults: 10 },
      { query: Q.reviews[1], maxResults: 10 },
      { query: Q.reviews[2], maxResults: 10 },
    ];
    if (slug) {
      for (const q of Q.reviewsBySlug(slug)) {
        probes.push({ query: q, domains: ["yelp.com"], maxResults: 10 });
      }
    }
    // Yelp menu-item pages are photo-dense; ride the probes we already make.
    const fetched = await gather(ctx, id, probes, { images: true });

    // Menu-item pages first so the 90-passage cap spends itself on real prose.
    const pool = [...located, ...fetched].sort(
      (a, b) => reviewPriority(a.url) - reviewPriority(b.url),
    );

    const items = harvest(pool, {
      reviewsOnly: true,
      maxPassages: REVIEW_MAX_PASSAGES,
      maxChars: PASSAGE_CHARS,
    });

    if (!items.length) {
      status(ctx, id, "extracting", "No review prose in the cached pages");
      ctx.dispatch({ type: "reviews/collected", reviews: [] });
      done(ctx, id, 0);
      return;
    }

    // Extraction is chunked and run concurrently on purpose. A single 90-passage
    // call at 16k max_tokens measured slower than the swarm's 75s global abort
    // on a live run (Evvia: started at +14s, still unfinished at cutoff, so the
    // agent returned zero reviews). Three ~30-passage calls at 6k tokens finish
    // in roughly the time of the slowest one, and a chunk that fails or gets
    // aborted only costs its own slice instead of the whole harvest.
    const chunks: Tagged[][] = [];
    for (let i = 0; i < items.length; i += REVIEW_CHUNK) {
      chunks.push(items.slice(i, i + REVIEW_CHUNK));
    }
    status(
      ctx,
      id,
      "extracting",
      `Parsing ${items.length} passages in ${chunks.length} batches`,
    );

    const settled = await Promise.allSettled(
      chunks.map((chunk) =>
        completeJSON<ParsedReview[]>(
          REVIEW_EXTRACT_PROMPT(ctx.name, ctx.city, toBlocks(chunk), todayISO()),
          6000,
          ctx.signal,
        ),
      ),
    );

    const seen = new Set<string>();
    const reviews: ParsedReview[] = [];
    for (const outcome of settled) {
      if (outcome.status !== "fulfilled") continue;
      for (const r of asArray<ParsedReview>(outcome.value)) {
        if (!r || typeof r.text !== "string" || !r.text.trim()) continue;
        const key = r.text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 60);
        if (seen.has(key)) continue;
        seen.add(key);
        reviews.push(r);
      }
    }

    // Every chunk failing is a real failure, not an empty restaurant.
    if (!reviews.length && settled.every((s) => s.status === "rejected")) {
      throw settled[0].status === "rejected"
        ? settled[0].reason
        : new Error("Review extraction failed.");
    }

    ctx.dispatch({ type: "reviews/collected", reviews });
    ctx.dispatch({
      type: "agent/evidence",
      id,
      items: reviews.slice(0, EVIDENCE_BATCH).map((r) => ({
        id: evidenceId(id),
        kind: "review" as const,
        text: r.text,
        source: r.source || "unknown",
        stars: r.stars ?? null,
        date: r.date ?? null,
        agent: id,
      })),
    });
    done(ctx, id, reviews.length);
  });
}

// ---------- PRESS ----------

export async function pressAgent(ctx: AgentCtx): Promise<void> {
  const id: AgentId = "press";
  await guard(ctx, id, async () => {
    const Q = QUERIES(ctx.name, ctx.city);
    status(ctx, id, "searching", "Sweeping critics and guides");

    // site: lives inside the michelin/jamesbeard queries, so no domain filter.
    const results = await gather(
      ctx,
      id,
      [
        { query: Q.press[0], domains: DOMAINS.press },
        { query: Q.press[1] },
        { query: Q.press[2] },
        { query: Q.press[3] },
      ],
      { images: true },
    );

    status(ctx, id, "reading", `Reading ${results.length} pages`);
    // No looksLikeReview here — criticism is written in the third person.
    const items = harvest(results, {
      maxPassages: FINDING_MAX_PASSAGES,
      maxChars: PASSAGE_CHARS,
    });

    const findings = await extractFindings(ctx, id, PRESS_LENS, items);
    emitFindings(ctx, id, findings);
    done(ctx, id, findings.length);
  });
}

// ---------- PULSE ----------

export async function pulseAgent(ctx: AgentCtx): Promise<void> {
  const id: AgentId = "pulse";
  await guard(ctx, id, async () => {
    const Q = QUERIES(ctx.name, ctx.city);
    status(ctx, id, "searching", "Hunting ownership and chef changes");

    const results = await gather(
      ctx,
      id,
      Q.pulse.map((query) => ({ query })),
    );

    status(ctx, id, "reading", `Reading ${results.length} pages`);
    const items = harvest(results, {
      maxPassages: FINDING_MAX_PASSAGES,
      maxChars: PASSAGE_CHARS,
    });

    const findings = await extractFindings(ctx, id, PULSE_LENS, items);
    emitFindings(ctx, id, findings);
    done(ctx, id, findings.length);
  });
}

// ---------- SOCIAL ----------

const QUIET_PULSE: SocialPulse = {
  buzz_level: "quiet",
  driving_it: "No significant social footprint found.",
  mentions: [],
};

export async function socialAgent(ctx: AgentCtx): Promise<void> {
  const id: AgentId = "social";
  await guard(ctx, id, async () => {
    const Q = QUERIES(ctx.name, ctx.city);
    status(ctx, id, "searching", "Checking TikTok, Instagram, X");

    const results = await gather(
      ctx,
      id,
      Q.social.map((query) => ({ query, maxResults: 6 })),
    );

    // Social platforms ship almost nothing in raw_content — the signal is in
    // the search snippet (title + content). Raw passages are a bonus.
    const heads: Tagged[] = [];
    for (const r of results) {
      const text = [r.title, r.content].filter(Boolean).join(" — ").trim();
      if (text) heads.push({ domain: hostOf(r.url), text: clip(text, SOCIAL_CHARS) });
    }
    const items = [
      ...heads,
      ...harvest(results, { maxPassages: 20, maxChars: SOCIAL_CHARS }),
    ].slice(0, SOCIAL_MAX_BLOCKS);

    status(ctx, id, "extracting", `Judging buzz from ${items.length} snippets`);

    // A fabricated buzz level is worse than no buzz level. Any failure here
    // degrades to an honest "quiet", and the agent still reports done.
    let pulse: SocialPulse = QUIET_PULSE;
    if (items.length) {
      try {
        const raw = await completeJSON<SocialPulse>(
          SOCIAL_EXTRACT_PROMPT(ctx.name, ctx.city, toBlocks(items)),
          4000,
          ctx.signal,
        );
        const mentions = asArray<SocialPulse["mentions"][number]>(raw?.mentions).filter(
          (m) => m && typeof m.gist === "string" && m.gist.trim(),
        );
        if (mentions.length && raw?.buzz_level) {
          pulse = {
            buzz_level: raw.buzz_level,
            driving_it: raw.driving_it || "Scattered mentions, no single driver.",
            mentions,
          };
        }
      } catch {
        pulse = QUIET_PULSE;
      }
    }

    ctx.dispatch({ type: "social/collected", pulse });
    ctx.dispatch({
      type: "agent/evidence",
      id,
      items: pulse.mentions.slice(0, EVIDENCE_BATCH).map((m) => ({
        id: evidenceId(id),
        kind: "social" as const,
        text: m.quote?.trim() || m.gist,
        source: m.platform || hostOf(m.url ?? ""),
        agent: id,
      })),
    });
    done(ctx, id, pulse.mentions.length);
  });
}

// ---------- MENU ----------

const MENU_LENS = `
Your lens: the menu and what it costs. Extract dish names with their stated
prices, portion sizes, recent price increases or menu changes, prix-fixe or
tasting-menu structure, and anything that speaks to value for money.`.trim();

export async function menuAgent(ctx: AgentCtx): Promise<void> {
  const id: AgentId = "menu";
  await guard(ctx, id, async () => {
    const Q = QUERIES(ctx.name, ctx.city);
    status(ctx, id, "searching", "Pulling the menu and prices");

    const results = await gather(ctx, id, [{ query: Q.menu[0] }]);

    status(ctx, id, "reading", `Reading ${results.length} pages`);
    const items = harvest(results, {
      maxPassages: FINDING_MAX_PASSAGES,
      maxChars: PASSAGE_CHARS,
    });

    const findings = await extractFindings(ctx, id, MENU_LENS, items, 4000);
    emitFindings(ctx, id, findings);
    done(ctx, id, findings.length);
  });
}

// ---------- INSPECTOR ----------

const INSPECTOR_LENS = `
Your lens: public health inspection and food-safety records. Extract inspection
dates, scores or letter grades, the specific violations cited, and any closure
or re-inspection. Report only what the passages actually state — an absence of
records is itself a valid answer.`.trim();

const NO_INSPECTION: Finding[] = [
  {
    finding: "No public inspection data found.",
    quote: null,
    source: "—",
    date: null,
  },
];

export async function inspectorAgent(ctx: AgentCtx): Promise<void> {
  const id: AgentId = "inspector";
  await guard(ctx, id, async () => {
    const Q = QUERIES(ctx.name, ctx.city);
    status(ctx, id, "searching", "Checking health inspection records");

    const results = await gather(ctx, id, [{ query: Q.inspection[0] }]);

    status(ctx, id, "reading", `Reading ${results.length} pages`);
    const items = harvest(results, {
      maxPassages: FINDING_MAX_PASSAGES,
      maxChars: PASSAGE_CHARS,
    });

    const findings = await extractFindings(ctx, id, INSPECTOR_LENS, items, 4000);

    // Nothing found is a result, not a failure.
    if (!findings.length) {
      ctx.dispatch({ type: "findings/collected", agent: id, findings: NO_INSPECTION });
      done(ctx, id, 0);
      return;
    }

    emitFindings(ctx, id, findings);
    done(ctx, id, findings.length);
  });
}

// ---------- CONTEXT ----------

export async function contextAgent(ctx: AgentCtx): Promise<void> {
  const id: AgentId = "context";
  await guard(ctx, id, async () => {
    const Q = QUERIES(ctx.name, ctx.city);
    status(ctx, id, "searching", "Sourcing industry benchmarks");

    const results = await gather(
      ctx,
      id,
      Q.context.map((query) => ({ query, maxResults: 6 })),
    );

    status(ctx, id, "reading", `Reading ${results.length} pages`);
    const items = harvest(results, {
      maxPassages: CONTEXT_MAX_PASSAGES,
      maxChars: PASSAGE_CHARS,
    });

    let stats: ContextStat[] = [];
    if (items.length) {
      status(ctx, id, "extracting", "Extracting citable statistics");
      try {
        const raw = await completeJSON<ContextStat[]>(
          CONTEXT_EXTRACT_PROMPT(toBlocks(items)),
          2000,
          ctx.signal,
        );
        stats = asArray<ContextStat>(raw).filter(
          (s) => s && typeof s.stat === "string" && s.stat.trim(),
        );
      } catch {
        stats = [];
      }
    }

    // This agent is never load-bearing — top up from the captured fallbacks.
    if (stats.length < 2) {
      const seen = new Set(stats.map((s) => s.stat.toLowerCase().slice(0, 40)));
      for (const f of FALLBACK_STATS) {
        if (stats.length >= 2) break;
        const key = f.stat.toLowerCase().slice(0, 40);
        if (seen.has(key)) continue;
        seen.add(key);
        stats.push({ stat: f.stat, source: f.source });
      }
    }

    ctx.dispatch({ type: "context/collected", stats });
    done(ctx, id, stats.length);
  });
}
