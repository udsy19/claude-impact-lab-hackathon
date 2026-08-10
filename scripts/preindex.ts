/**
 * Pre-index a city: resolve each seed restaurant, run the full swarm + health
 * lookup, and write the dossier. This is the moat — every row written here is
 * a user who never waits for a live run.
 *
 *   npx tsx scripts/preindex.ts seed/sf.json [--limit 20] [--dry]
 *
 * Resumable (skips fresh dossiers), concurrency 3, per-restaurant cost ceiling.
 */
import fs from "node:fs";
import path from "node:path";

// The browser modules read import.meta.env; give them a shim before importing.
const env = loadEnv();
(globalThis as unknown as { importMetaEnv?: unknown }).importMetaEnv = env;

const CONCURRENCY = 3;
const MAX_COST_PER_RESTAURANT = 1.5;

// claude-sonnet-4-6 list price, $/token.
const IN_RATE = 3 / 1_000_000;
const OUT_RATE = 15 / 1_000_000;
const TAVILY_PER_SEARCH = 0.008; // advanced search, approximate

interface SeedRow {
  name: string;
  neighborhood: string;
  vibes: string[];
  price_tier: number | null;
}

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of [".env.local", ".env"]) {
    const p = path.resolve(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

function requireEnv(k: string): string {
  const v = env[k] ?? process.env[k];
  if (!v) {
    console.error(`missing ${k} — put it in .env.local`);
    process.exit(1);
  }
  return v;
}

const TAVILY = requireEnv("VITE_TAVILY_API_KEY");
const ANTHROPIC = requireEnv("VITE_ANTHROPIC_API_KEY");
const SUPABASE_URL = env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_KEY =
  env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";

let spend = 0;
const log = (...a: unknown[]) => console.log(...a);

async function tavily(query: string, opts: Record<string, unknown> = {}) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TAVILY}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "advanced",
      include_raw_content: true,
      max_results: 8,
      ...opts,
    }),
  });
  spend += TAVILY_PER_SEARCH;
  if (!res.ok) throw new Error(`tavily ${res.status}`);
  return res.json() as Promise<{ results?: { url: string; title: string; raw_content?: string | null }[] }>;
}

async function claude(prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    content: { type: string; text?: string }[];
    usage?: { input_tokens: number; output_tokens: number };
  };
  if (data.usage) {
    spend += data.usage.input_tokens * IN_RATE + data.usage.output_tokens * OUT_RATE;
  }
  return data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

function parseJSON<T>(raw: string): T {
  let s = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fenced) s = fenced[1].trim();
  try {
    return JSON.parse(s) as T;
  } catch {
    const a = s.search(/[[{]/);
    const b = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
    if (a !== -1 && b > a) return JSON.parse(s.slice(a, b + 1)) as T;
    throw new Error("bad JSON from model");
  }
}

async function supa(pathname: string, init: RequestInit = {}) {
  if (!SUPABASE_URL) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${SUPABASE_KEY}`,
      "content-type": "application/json",
      Prefer: "return=representation,resolution=merge-duplicates",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : await res.json();
}

const slugify = (name: string, city: string) =>
  `${name}-${city}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function indexOne(row: SeedRow, city: string): Promise<void> {
  const before = spend;
  const label = `${row.name} (${row.neighborhood})`;
  const slug = slugify(row.name, city === "San Francisco" ? "sf" : city);

  // Resumable: never pay twice for a dossier that is still fresh.
  if (SUPABASE_URL) {
    const existing = (await supa(
      `dossiers?select=id,status,refresh_after,restaurant_id,restaurants!inner(slug)&restaurants.slug=eq.${slug}`,
    )) as { status: string; refresh_after: string | null }[] | null;
    const d = existing?.[0];
    if (d && d.status === "fresh" && d.refresh_after && Date.parse(d.refresh_after) > Date.now()) {
      log(`  skip  ${label} — dossier still fresh`);
      return;
    }
  }

  // 1. Locate + harvest review prose. Yelp menu-item pages carry the volume;
  //    /biz/ pages are chrome and /extract 403s on them (see README field notes).
  const locate = await tavily(`"${row.name}" "${city}" site:yelp.com`, {
    include_domains: ["yelp.com"],
    include_raw_content: false,
  });
  const slugMatch = locate.results
    ?.map((r) => /yelp\.com\/(?:biz|menu)\/([a-z0-9-]+)/i.exec(r.url)?.[1])
    .find(Boolean);

  const probes = [
    tavily(`"${row.name}" "${city}" yelp menu item review ordered delicious service`, {
      include_domains: ["yelp.com"],
    }),
    tavily(`"${row.name}" "${city}" reviews service food experience`),
    tavily(`site:eater.com "${row.name}"`),
  ];
  if (slugMatch) {
    probes.push(
      tavily(`yelp.com/menu/${slugMatch}/item reviews photos`, {
        include_domains: ["yelp.com"],
      }),
    );
  }
  const settled = await Promise.allSettled(probes);

  const seen = new Set<string>();
  const passages: string[] = [];
  const sources = new Set<string>();
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    for (const r of s.value.results ?? []) {
      try {
        sources.add(new URL(r.url).hostname.replace(/^www\./, ""));
      } catch {
        /* malformed url from tavily — skip the host, keep the text */
      }
      for (const line of (r.raw_content ?? "").split("\n")) {
        const t = line.trim();
        if (t.length < 140 || /^[[!#*\-|>]/.test(t) || t.includes("http")) continue;
        if (!/\b(I|we|my|our|us|me)\b/.test(t)) continue;
        const key = t.slice(0, 80).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        passages.push(t.slice(0, 700));
        if (passages.length >= 60) break;
      }
    }
  }

  if (passages.length < 5) {
    log(`  thin  ${label} — only ${passages.length} passages, skipping`);
    return;
  }

  // 2. Synthesize. One call at this scale; the app chunks because it races a
  //    75s UI budget, which a batch script does not.
  const prompt = `You are an operations analyst for restaurants. Below are verbatim passages about "${row.name}" in ${city}.

<passages>
${passages.map((p) => `- ${p}`).join("\n")}
</passages>

Return ONLY JSON:
{"verdict":"one sentence, <=20 words, the whole situation",
 "badges":[{"label":"","domain":"","year":null}],
 "vitals":{"price_tier":null,"booking_difficulty":null,"busiest":null,"best_time_to_try":null,"reservation_route":null},
 "patterns":[{"title":"<=10 words","frequency":"","trend":"improving|worsening|stable|new","excerpts":["3+ verbatim"],"sources":[""]}],
 "diner_view":{"should_you_go":"","order_this":[],"skip_this":[],"getting_in":"","know_before":[],"go_when":null},
 "key_reviews":[{"quote":"","stars":null,"date":null,"source":"","why_chosen":"most_representative|most_alarming|most_promising"}],
 "bright_spots":[{"finding":"","excerpts":[]}]}

Rules: excerpts VERBATIM from the passages, never paraphrased. Badges ONLY from
explicit evidence — never infer an award. Vitals null unless evidenced. Name
dishes. No generic filler.`;

  const analysis = parseJSON<Record<string, unknown>>(await claude(prompt, 4000));

  // Health is free (open data) and independent of the swarm, so it always runs.
  // A refusal is a valid result — never write another restaurant's violations.
  let health: unknown = { status: "no_confident_match" };
  try {
    const { lookupHealth } = await import("../src/health/index.ts");
    health = await lookupHealth({ name: row.name, city, lat: null, lng: null });
  } catch (e) {
    log(`  health lookup failed for ${row.name}: ${(e as Error).message}`);
  }

  const cost = spend - before;
  if (cost > MAX_COST_PER_RESTAURANT) {
    log(`  ABORT ${label} — $${cost.toFixed(3)} exceeded the ceiling`);
    return;
  }

  if (!SUPABASE_URL) {
    log(`  ok    ${label} — $${cost.toFixed(3)} (dry: no Supabase configured)`);
    return;
  }

  const [restaurant] = (await supa("restaurants?on_conflict=slug", {
    method: "POST",
    body: JSON.stringify([
      {
        name: row.name,
        slug,
        city,
        neighborhood: row.neighborhood,
        vibe_tags: row.vibes,
        price_tier: row.price_tier,
      },
    ]),
  })) as { id: string }[];

  const evidence = passages.slice(0, 40).map((p) => ({
    text: p.split(/\s+/).slice(0, 40).join(" "),
    source: "yelp.com",
    url: null,
    date: null,
    kind: "review",
  }));

  await supa("dossiers?on_conflict=restaurant_id", {
    method: "POST",
    body: JSON.stringify([
      {
        restaurant_id: restaurant.id,
        status: "fresh",
        ...analysis,
        health,
        health_checked_at: new Date().toISOString(),
        evidence,
        sources: [...sources],
        evidence_count: evidence.length,
        generated_at: new Date().toISOString(),
        refresh_after: new Date(Date.now() + 30 * 864e5).toISOString(),
      },
    ]),
  });

  log(`  ok    ${label} — $${cost.toFixed(3)}, ${passages.length} passages`);
}

async function main() {
  const file = process.argv[2] ?? "seed/sf.json";
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

  const seed = JSON.parse(fs.readFileSync(path.resolve(file), "utf8")) as {
    city: string;
    restaurants: SeedRow[];
  };
  const rows = seed.restaurants.slice(0, limit);

  log(`pre-indexing ${rows.length} restaurants in ${seed.city}`);
  log(SUPABASE_URL ? "writing to Supabase" : "NO SUPABASE — dry run, nothing persisted");
  log("");

  const queue = [...rows];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const row = queue.shift();
      if (!row) return;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await indexOne(row, seed.city);
          break;
        } catch (e) {
          const wait = 2 ** attempt * 1500;
          if (attempt === 2) {
            log(`  FAIL  ${row.name} — ${(e as Error).message}`);
          } else {
            await new Promise((r) => setTimeout(r, wait));
          }
        }
      }
    }
  });

  await Promise.all(workers);
  log("");
  log(`done. total spend this run: $${spend.toFixed(2)}`);
}

void main();
