/**
 * stats.ts — pure, total derivations over the evidence pile.
 *
 * THE HONESTY RULE
 * ----------------
 * These numbers end up on a printed brief an operator will act on. A chart drawn
 * from four reviews is not a smaller truth, it is a confident lie: the eye reads
 * a slope where there is only noise. So every function here is built to make
 * thinness *visible* rather than smooth it over —
 *
 *   - the rated subset is reported separately from the raw review count, because
 *     "128 reviews" and "9 with a star rating" are different claims;
 *   - time buckets with zero reviews are omitted, never interpolated, so a gap
 *     stays a gap instead of becoming a line segment;
 *   - a category nobody mentioned is dropped rather than shown as a zero bar;
 *   - date range degrades to "date range unknown" instead of guessing.
 *
 * The callers (the chart components) enforce the other half of the rule: they
 * return null — render nothing at all — below their minimum sample. A missing
 * chart is honest. A chart of noise is not.
 *
 * No React, no component imports. Every function is total: never throws, always
 * handles empty/garbage input.
 */

import type { Finding, ParsedReview, PatternCategory } from "../types";

// ---------------------------------------------------------------- primitives

/** Parsed calendar parts of an ISO date, or null if unusable. */
interface DateParts {
  y: number;
  m: number; // 1-12
  d: number; // 1-31
  ms: number; // epoch ms at noon UTC, for span math only
}

function parseISO(iso: string | null | undefined): DateParts | null {
  if (typeof iso !== "string") return null;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = m[3] ? Number(m[3]) : 1;
  if (!Number.isFinite(y) || y < 1900 || y > 2200) return null;
  if (!(mo >= 1 && mo <= 12)) return null;
  if (!(d >= 1 && d <= 31)) return null;
  const ms = Date.UTC(y, mo - 1, d, 12);
  if (Number.isNaN(ms)) return null;
  return { y, m: mo, d, ms };
}

/** True when `stars` is a usable 1-5 rating. */
function isRated(stars: number | null | undefined): stars is number {
  return typeof stars === "number" && Number.isFinite(stars) && stars >= 1 && stars <= 5;
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// -------------------------------------------------------------- distribution

export interface RatingBar {
  star: number;
  count: number;
  /** Percent of the *rated* subset, 0-100, one decimal. */
  pct: number;
}

/**
 * Counts per star, 5 down to 1. Always five rows, even when every count is 0 —
 * the shape of the axis should not change with the data.
 */
export function ratingDistribution(reviews: ParsedReview[]): RatingBar[] {
  const counts = new Map<number, number>([[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);
  let rated = 0;

  for (const r of reviews ?? []) {
    const s = r?.stars;
    if (!isRated(s)) continue;
    const key = Math.round(s);
    if (key < 1 || key > 5) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    rated++;
  }

  return [5, 4, 3, 2, 1].map((star) => {
    const count = counts.get(star) ?? 0;
    return { star, count, pct: rated === 0 ? 0 : round((count / rated) * 100, 1) };
  });
}

/** How many reviews carry a usable 1-5 star rating. */
export function ratedCount(reviews: ParsedReview[]): number {
  let n = 0;
  for (const r of reviews ?? []) if (isRated(r?.stars)) n++;
  return n;
}

/** Mean of the rated subset, two decimals. Null when nothing is rated. */
export function averageRating(reviews: ParsedReview[]): number | null {
  let sum = 0;
  let n = 0;
  for (const r of reviews ?? []) {
    const s = r?.stars;
    if (!isRated(s)) continue;
    sum += s;
    n++;
  }
  return n === 0 ? null : round(sum / n, 2);
}

// ------------------------------------------------------------------ over time

export type BucketMode = "quarter" | "month";

export interface TimeBucket {
  /** Sortable key: "2026-Q2" or "2026-05". */
  bucket: string;
  /** Human label: "Q2 '26" or "May '26". */
  label: string;
  avg: number;
  n: number;
}

/** Span below which we fall back to monthly buckets (~9 months). */
const MONTHLY_SPAN_DAYS = 274;
const DAY_MS = 86_400_000;

/**
 * The bucket key a date belongs to under a given mode. Exported so a caller
 * (e.g. an event annotation) can locate a date on an already-plotted axis
 * without re-deriving the bucketing rules.
 */
export function bucketKeyFor(iso: string | null, mode: BucketMode): string | null {
  const p = parseISO(iso);
  if (!p) return null;
  if (mode === "month") return `${p.y}-${String(p.m).padStart(2, "0")}`;
  return `${p.y}-Q${Math.floor((p.m - 1) / 3) + 1}`;
}

/** Human label for a bucket key. Falls back to the key itself if unparseable. */
export function bucketLabel(bucket: string): string {
  const q = /^(\d{4})-Q([1-4])$/.exec(bucket);
  if (q) return `Q${q[2]} '${q[1].slice(2)}`;
  const m = /^(\d{4})-(\d{2})$/.exec(bucket);
  if (m) {
    const idx = Number(m[2]) - 1;
    if (idx >= 0 && idx < 12) return `${MONTHS[idx]} '${m[1].slice(2)}`;
  }
  return bucket;
}

/** Which bucketing a set of reviews would use — same rule ratingOverTime applies. */
export function bucketModeFor(reviews: ParsedReview[]): BucketMode {
  let min = Infinity;
  let max = -Infinity;
  for (const r of reviews ?? []) {
    if (!isRated(r?.stars)) continue;
    const p = parseISO(r?.date);
    if (!p) continue;
    if (p.ms < min) min = p.ms;
    if (p.ms > max) max = p.ms;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return "quarter";
  return (max - min) / DAY_MS < MONTHLY_SPAN_DAYS ? "month" : "quarter";
}

/**
 * Average rating per time bucket, chronological. Only reviews that have BOTH a
 * parseable date and a numeric star count are used. Empty buckets are omitted —
 * we never draw through a period we have no evidence for.
 */
export function ratingOverTime(reviews: ParsedReview[]): TimeBucket[] {
  const usable: { ms: number; stars: number; date: string }[] = [];
  for (const r of reviews ?? []) {
    const s = r?.stars;
    if (!isRated(s)) continue;
    const p = parseISO(r?.date);
    if (!p) continue;
    usable.push({ ms: p.ms, stars: s, date: r.date as string });
  }
  if (usable.length === 0) return [];

  const mode = bucketModeFor(reviews);
  const acc = new Map<string, { sum: number; n: number }>();
  for (const u of usable) {
    const key = bucketKeyFor(u.date, mode);
    if (!key) continue;
    const cur = acc.get(key) ?? { sum: 0, n: 0 };
    cur.sum += u.stars;
    cur.n += 1;
    acc.set(key, cur);
  }

  return [...acc.entries()]
    .map(([bucket, { sum, n }]) => ({
      bucket,
      label: bucketLabel(bucket),
      avg: round(sum / n, 2),
      n,
    }))
    .sort((a, b) => (a.bucket < b.bucket ? -1 : a.bucket > b.bucket ? 1 : 0));
}

// ---------------------------------------------------------------- mention heat

export interface MentionRow {
  category: PatternCategory;
  positive: number;
  negative: number;
  /** All reviews mentioning the category, including sentiment-neutral ones. */
  total: number;
}

/**
 * Keyword surface per category. Deliberately plain-language: these match how
 * diners actually write, not how operators categorize. A review may hit several.
 */
const CATEGORY_KEYWORDS: Record<PatternCategory, string[]> = {
  pacing: ["wait", "waited", "waiting", "slow", "took", "minutes", "rushed", "pace", "forever", "prompt", "quick"],
  pricing: ["price", "prices", "pricey", "expensive", "$", "overpriced", "value", "cheap", "cost", "worth it", "portion"],
  staffing: ["server", "servers", "staff", "understaffed", "host", "hostess", "waiter", "waitress", "manager", "bartender"],
  service: ["service", "attentive", "rude", "friendly", "ignored", "greeted", "hospitality", "checked on"],
  food: ["food", "dish", "dishes", "flavor", "cooked", "dry", "delicious", "tasty", "bland", "portion", "menu", "salty", "fresh"],
  ambience: ["loud", "noise", "noisy", "atmosphere", "ambience", "ambiance", "decor", "music", "seating", "patio", "cramped", "vibe"],
  consistency: ["every time", "again", "consistent", "consistency", "used to", "always", "never fails", "each visit", "hit or miss"],
};

const POSITIVE_WORDS = [
  "great", "delicious", "amazing", "love", "loved", "excellent", "best", "friendly",
  "perfect", "wonderful", "fantastic", "favorite", "attentive", "fresh", "recommend",
  "solid", "gem", "generous",
];

const NEGATIVE_WORDS = [
  "bad", "terrible", "awful", "rude", "cold", "dry", "overpriced", "disappointing",
  "disappointed", "worst", "never again", "bland", "dirty", "greasy", "mediocre",
  "avoid", "wrong", "ignored", "understaffed", "soggy",
];

/** Word-boundary matcher for alphabetic terms, raw substring for symbols. */
function compile(words: string[]): RegExp {
  const parts = words.map((w) => {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return /^[a-z][a-z' ]*$/.test(w) ? `\\b${esc}\\b` : esc;
  });
  return new RegExp(parts.join("|"), "i");
}

const CATEGORY_RE = Object.fromEntries(
  (Object.keys(CATEGORY_KEYWORDS) as PatternCategory[]).map((c) => [
    c,
    compile(CATEGORY_KEYWORDS[c]),
  ]),
) as Record<PatternCategory, RegExp>;

const POSITIVE_RE = compile(POSITIVE_WORDS);
const NEGATIVE_RE = compile(NEGATIVE_WORDS);

type Sentiment = "positive" | "negative" | "neutral";

/**
 * Stars win when present — they are the reviewer's own summary judgement.
 * 3 stars is genuinely ambivalent and is counted as neither. Only unrated
 * reviews fall back to word matching, and ambiguous prose stays neutral.
 */
function sentimentOf(review: ParsedReview): Sentiment {
  const s = review?.stars;
  if (isRated(s)) {
    if (s >= 4) return "positive";
    if (s <= 2) return "negative";
    return "neutral";
  }
  const text = typeof review?.text === "string" ? review.text : "";
  if (!text) return "neutral";
  const pos = POSITIVE_RE.test(text);
  const neg = NEGATIVE_RE.test(text);
  if (pos && !neg) return "positive";
  if (neg && !pos) return "negative";
  return "neutral";
}

/**
 * What the reviews are actually about, by category, split by sentiment.
 * Categories nobody mentioned are omitted rather than shown as empty bars.
 */
export function mentionHeat(reviews: ParsedReview[]): MentionRow[] {
  const rows = new Map<PatternCategory, MentionRow>();

  for (const r of reviews ?? []) {
    const text = typeof r?.text === "string" ? r.text : "";
    if (!text) continue;
    const tone = sentimentOf(r);

    for (const category of Object.keys(CATEGORY_RE) as PatternCategory[]) {
      if (!CATEGORY_RE[category].test(text)) continue;
      const row =
        rows.get(category) ?? { category, positive: 0, negative: 0, total: 0 };
      if (tone === "positive") row.positive++;
      else if (tone === "negative") row.negative++;
      row.total++;
      rows.set(category, row);
    }
  }

  return [...rows.values()]
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
}

// ----------------------------------------------------------------- date range

export interface DateRange {
  from: string | null;
  to: string | null;
  label: string;
}

function monthYear(p: DateParts): string {
  return `${MONTHS[p.m - 1]} ${p.y}`;
}

/** Earliest and latest dated review, plus a printable label. */
export function dateRange(reviews: ParsedReview[]): DateRange {
  let lo: DateParts | null = null;
  let hi: DateParts | null = null;
  let loISO: string | null = null;
  let hiISO: string | null = null;

  for (const r of reviews ?? []) {
    const p = parseISO(r?.date);
    if (!p) continue;
    if (!lo || p.ms < lo.ms) {
      lo = p;
      loISO = r.date;
    }
    if (!hi || p.ms > hi.ms) {
      hi = p;
      hiISO = r.date;
    }
  }

  if (!lo || !hi) return { from: null, to: null, label: "date range unknown" };
  const a = monthYear(lo);
  const b = monthYear(hi);
  return { from: loISO, to: hiISO, label: a === b ? a : `${a} – ${b}` };
}

// ------------------------------------------------------------- pulse annotation

/**
 * Words that mark a discontinuity — a before/after the ratings line may be
 * bending around. Anything vaguer is not worth annotating a chart with.
 */
const DISCONTINUITY_RE =
  /\b(chef|owner|reopen(?:ed|ing)?|renovat\w*|closed|closure|new management|sold|expansion|expanded|takeover|took over|rebrand\w*)\b/i;

export interface PulseEvent {
  date: string;
  finding: string;
}

/**
 * The most recent dated finding that describes a discontinuity, used to
 * annotate the ratings timeline. Null when nothing qualifies — an unexplained
 * bend is better than a wrongly explained one.
 */
export function pulseEventDate(findings: Finding[]): PulseEvent | null {
  let best: { ms: number; date: string; finding: string } | null = null;

  for (const f of findings ?? []) {
    const p = parseISO(f?.date);
    if (!p) continue;
    const text = `${f?.finding ?? ""} ${f?.quote ?? ""}`;
    if (!DISCONTINUITY_RE.test(text)) continue;
    const finding = typeof f?.finding === "string" ? f.finding.trim() : "";
    if (!finding) continue;
    if (!best || p.ms > best.ms) best = { ms: p.ms, date: f.date as string, finding };
  }

  return best ? { date: best.date, finding: best.finding } : null;
}
