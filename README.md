# Tablestakes

**Every restaurant has a consultant working for free — their customers. This is
the tool that reads the report.**

Type a restaurant name. A swarm of research agents fans out across the public
web in parallel — reviews, press, news, social, menus, inspections — each
visibly working on screen. Their findings converge into a one-page **Operator
Brief**: the recurring operational patterns, what changed recently, and the
single highest-leverage fix this week, every claim backed by verbatim excerpts
with source provenance.

It's an ops audit disguised as a review tool, and you watch the investigation
happen live.

---

## Running it

```bash
npm install
cp .env.example .env.local     # then fill in both keys
npm run dev
```

`.env.local` needs:

```
VITE_TAVILY_API_KEY=tvly-...
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

Both APIs are called directly from the browser — Tavily allows cross-origin
requests, and Anthropic is called with
`anthropic-dangerous-direct-browser-access: true`. There is no backend.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run typecheck` | **Use this, not bare `tsc --noEmit`** — see below |
| `npm run build` | Production build |

> ⚠️ `tsconfig.json` is a solution file (`"files": []` + project references), so
> a bare `npx tsc --noEmit` type-checks **nothing** and exits 0. Always use
> `npm run typecheck`.

### Offline demo

Append `?demo=1` to the dev URL (or press `D` on the start screen) to replay a
captured swarm run with realistic timing and **zero network calls** — same
agents, same out-of-order finishes, same amber failure, same streamed
synthesis, same brief. This is the stage fallback.

---

## How it works

```
name + city
     │
     ▼
  runSwarm ──► 7 agents under Promise.allSettled, 75s global abort
     │            reviews · press · pulse · social · menu · inspector · context
     │            each: Tavily search ──► passage harvest ──► Claude extraction
     ▼
  reducer ──► one SwarmState (this event stream is also what the Engine renders)
     │
     ▼
  synthesis ──► streamed Claude call ──► Analysis JSON ──► Operator Brief
```

| Path | What lives there |
|---|---|
| `src/swarm/` | `reducer.ts` (pure), `agents.ts` (the seven), `runSwarm.ts` (fan-out + timeout) |
| `src/api/` | `tavily.ts` (search/extract/harvest helpers), `claude.ts` (incl. SSE streaming) |
| `src/prompts.ts` | Every prompt, in one file, so they're easy to iterate on |
| `src/lib/stats.ts` | Pure rating/mention statistics — no React, hand-verified |
| `src/views/` | `Engine.tsx` (dark, live) and `Brief.tsx` (light, the artifact) |
| `src/fixtures/` | `sample_reviews.ts` (planted-pattern oracle), `sample_swarm.ts` (offline replay) |

An "agent" here is deliberately unglamorous: an async function with a name, a
Tavily strategy, and an extraction prompt, dispatching lifecycle events into a
reducer. That single event stream is both the architecture and the demo.

---

## Field notes

These were established by probing the live APIs, and they shaped the design.
Worth reading before changing the reviews pipeline:

- **Tavily `/extract` 403s on yelp.com.** Do not build on it.
- **Tavily `/search` with `include_raw_content: true` does return cached Yelp
  content.** That's the way in.
- **`yelp.com/biz/<slug>` is chrome** — ~10k characters yielding 2 prose lines.
- **`yelp.com/menu/<slug>/item/<dish>` carries 40–70 verbatim customer
  passages.** Landing those pages is the REVIEWS agent's actual job, which is
  why the passage pool is priority-sorted before the payload cap is applied —
  otherwise nav markup starves the good pages.
- **`include_domains` is a soft filter.** Off-list domains still return, and
  they're often the best material (foodnut.com, hungryonion.org), so nothing is
  discarded on domain.
- **Tavily occasionally returns malformed URLs**, so `hostOf()` never throws.
- **Review extraction is chunked into concurrent calls.** One 90-passage call at
  16k `max_tokens` measured slower than the 75s global abort on a live run and
  returned zero reviews; three ~30-passage calls at 6k finish comfortably, and a
  failed chunk costs only its own slice.

## Honesty rules

The product is only worth anything if the evidence is real, so these are
enforced rather than encouraged:

- Excerpts must be **verbatim substrings** of source text; each carries the
  domain it came from.
- The provenance row shows **only domains that actually produced findings** — no
  decorating a taqueria's brief with a Michelin logo.
- Charts **hide themselves rather than lie**: the rating distribution needs ≥10
  rated reviews, the timeline needs ≥3 buckets. On live Yelp runs the star
  charts often hide, because Yelp's cached review text carries no star values.
- The SOCIAL agent returns `buzz_level: "quiet"` with an explicit
  "no significant social footprint found" rather than inventing buzz.
- The INSPECTOR agent reports a visible null result instead of failing quietly.
- A failing agent goes amber and the swarm continues.
