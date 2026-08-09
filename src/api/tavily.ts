/**
 * Tavily client. Validated live 2026-08-08:
 *  - Auth: `Authorization: Bearer <key>` (the legacy body `api_key` also works).
 *  - /extract 403s on yelp.com. Do not rely on it for reviews.
 *  - /search with include_raw_content DOES return cached Yelp content.
 *  - Results occasionally carry malformed URLs — hostOf() must never throw.
 */

const SEARCH_URL = "https://api.tavily.com/search";
const EXTRACT_URL = "https://api.tavily.com/extract";

export interface TavilyResult {
  url: string;
  title: string;
  content: string;
  raw_content: string | null;
  score?: number;
}

export class MissingTavilyKeyError extends Error {}

function key(): string {
  const k = import.meta.env.VITE_TAVILY_API_KEY as string | undefined;
  if (!k) {
    throw new MissingTavilyKeyError(
      "No Tavily key. Add VITE_TAVILY_API_KEY to .env.local and restart the dev server.",
    );
  }
  return k;
}

/** Never throws — malformed URLs in Tavily results are real and crashed a probe. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    const m = /^(?:https?:\/\/)?([^/\s]+)/i.exec(url ?? "");
    return m ? m[1].replace(/^www\./, "") : "unknown";
  }
}

async function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key()}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Tavily ${res.status}: ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export interface SearchOpts {
  domains?: readonly string[];
  maxResults?: number;
  raw?: boolean;
  /** Ask for `include_images`. Costs nothing extra — images ride the envelope. */
  images?: boolean;
  signal?: AbortSignal;
}

interface SearchEnvelope {
  results?: TavilyResult[];
  images?: unknown;
}

/**
 * The `images` array lives on the response envelope, not on the results.
 * Validated live 2026-08-08: entries are plain URL strings by default, and
 * become `{url, title, description}` objects when image descriptions are on.
 * Both shapes are handled; anything else is dropped.
 */
function normaliseImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    let url: unknown = entry;
    if (entry && typeof entry === "object") url = (entry as { url?: unknown }).url;
    if (typeof url !== "string") continue;
    const clean = url.trim();
    if (!/^https?:\/\//i.test(clean) || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

async function searchEnvelope(
  query: string,
  { domains, maxResults = 8, raw = true, images = false, signal }: SearchOpts,
): Promise<{ results: TavilyResult[]; images: string[] }> {
  const body: Record<string, unknown> = {
    query,
    search_depth: "advanced",
    include_raw_content: raw,
    max_results: maxResults,
  };
  if (domains?.length) body.include_domains = [...domains];
  if (images) body.include_images = true;
  const data = await post<SearchEnvelope>(SEARCH_URL, body, signal);
  return {
    results: (data.results ?? []).filter((r) => r && typeof r.url === "string"),
    images: normaliseImages(data.images),
  };
}

export async function search(
  query: string,
  opts: SearchOpts = {},
): Promise<TavilyResult[]> {
  return (await searchEnvelope(query, opts)).results;
}

/** Same probe as search(), but also returns deduped absolute image URLs. */
export async function searchWithImages(
  query: string,
  opts: SearchOpts = {},
): Promise<{ results: TavilyResult[]; images: string[] }> {
  return searchEnvelope(query, { ...opts, images: true });
}

/** Kept for non-Yelp targets (press articles extract fine). */
export async function extract(
  urls: string[],
  signal?: AbortSignal,
): Promise<TavilyResult[]> {
  if (!urls.length) return [];
  const data = await post<{ results?: TavilyResult[] }>(
    EXTRACT_URL,
    { urls, extract_depth: "advanced" },
    signal,
  );
  return data.results ?? [];
}

/**
 * Pull candidate prose passages out of a raw page dump. Cheap pre-filter so we
 * don't ship 50k chars of Yelp nav markup to Claude on every call.
 */
export function passages(raw: string | null | undefined, min = 120): string[] {
  const out: string[] = [];
  for (const line of (raw ?? "").split("\n")) {
    const l = line.trim();
    if (l.length < min) continue;
    if (/^[[!#*\-|>]/.test(l)) continue;
    if (l.includes("http") || l.includes("cdn") || l.includes("yelpcdn")) continue;
    out.push(l);
  }
  return out;
}

/** First-person voice is what separates a review from menu copy. */
export function looksLikeReview(p: string): boolean {
  return /\b(I|we|my|our|us|me|they|he|she)\b/.test(p);
}

export function yelpSlug(results: TavilyResult[]): string | null {
  for (const r of results) {
    const m = /yelp\.com\/(?:biz|menu)\/([a-z0-9-]+)/i.exec(r.url ?? "");
    if (m) return m[1];
  }
  return null;
}
