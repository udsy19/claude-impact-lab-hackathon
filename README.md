<div align="center">

# Tablestakes

### where should I eat, right now, near me?

**Four playful questions. Three real answers. Every one backed by receipts —
verbatim review excerpts, press, and health-inspection records, each with the
source it came from.**

`React 19` · `TypeScript` · `Vite PWA` · `Tailwind v4` · `Claude Sonnet 4.6` · `Tavily` · `Supabase` · `DataSF` · `NYC DOHMH`

</div>

---

## The two surfaces

**The Decision Flow** — you don't know what you want. Four tappable questions
(`what's the move?` · `damage?` · `how far?` · `hunger check`) and you get one
hero suggestion plus two runner-ups. No typing required; a free-text box accepts
"omakase" or "hookah" and maps it to real tags.

**The Dossier** — tap any suggestion and get the verification card: verdict,
what to order, what to skip, how to get in, and know-before-you-go including the
actual health inspection. This is the moat.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # add your keys
npm run dev
```

```env
VITE_TAVILY_API_KEY=tvly-...
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_SUPABASE_URL=            # optional — falls back to localStorage
VITE_SUPABASE_ANON_KEY=
```

**Supabase is live** (project `tablestakes`, us-west-1) and is what the app uses
when the two env vars are set. Without them it falls back to a localStorage store
implementing the same `Store` interface — everything still works, it just doesn't
sync across devices. `src/db/index.ts` picks the backend automatically.

To provision from scratch: `supabase projects create`, then apply
`supabase/migrations/0001_init.sql`.

**One RLS subtlety worth knowing:** `decision_logs` and `owner_claims` have INSERT
policies but no SELECT policy, so anon can write and never read them. That means
an insert must not request `return=representation` — `logDecision` generates its
own UUID client-side rather than reading the id back. Adding a SELECT policy to
"fix" a 42501 there would make every user's decision history world-readable.

| Command | |
|---|---|
| `npm run dev` | dev server |
| `npm run typecheck` | **use this, not bare `tsc --noEmit`** (see gotchas) |
| `npx tsx scripts/preindex.ts seed/sf.json --limit 20` | pre-index a city |

---

## Architecture

```
  four questions + location
            │
            ▼
   findCandidates ──► 1. our restaurants table   (instant)
            │         2. Overpass / OSM          (only if thin)
            │         3. Tavily + Claude names   (only if still thin)
            ▼
      rank ──► one Claude call: hard-filters time-of-day, distance, price;
            │  dossier-backed candidates outrank unknowns
            ▼
   hero + 2 runner-ups ──► tap ──► getDossier()
                                      │
                    fresh ────────────┤ serve instantly
                    stale ────────────┤ serve now, refresh behind the user
                    none  ────────────┘ live glass engine (the only cold path)
```

| Path | What lives there |
|---|---|
| `src/decision/` | constraint types, candidate discovery, the ranking prompt |
| `src/dossier/service.ts` | cache-first orchestration and TTL policy |
| `src/health/` | SF + NYC Socrata adapters and the confidence matcher |
| `src/db/` | `Store` interface, Supabase and localStorage backends |
| `src/swarm/` | the research agents (ported from the dossier engine) |
| `scripts/preindex.ts` | the moat: bulk-index a city ahead of demand |

### The cost model, which is the architecture

A fresh research run costs roughly **$0.50**. A cached dossier read costs
**nothing**. So the cache is exhausted before anything else runs: relax price,
then widen the radius, and only then touch Overpass or Tavily. Pre-indexing is
what makes the product economical — every row written by `preindex.ts` is a user
who never waits and never costs a swarm.

TTLs: 7 days for popular restaurants (≥3 views/week), 30 days otherwise. Health
has an independent 30-day clock, so a new inspection surfaces without paying for
a whole re-run.

---

## Health inspections — the differentiator

SF (DataSF LIVES) and NYC (DOHMH) open data, matched by name + coordinates with
a confidence scorer that **refuses rather than guesses**. Showing the wrong
restaurant's violations is the worst error this product could make, so distance
is a gate and not a tiebreak: past 250m, no name match can clear the threshold.

Verified live against 9 cases:

| Case | Result |
|---|---|
| Tartine Bakery, Zuni Cafe, La Taqueria, House of Prime Rib, Swan Oyster | matched, scores 87–96 |
| Katz's Delicatessen (NYC) | matched, score 56 — rats, filth flies, contaminated food |
| Peter Luger (Brooklyn) | matched, grade A |
| **"Kitchen" at SF coords** | **refused** — generic name can't clear the bar |
| **"Tartine Bakery" at NYC coords** | **refused** — right name, wrong city |

Two things worth knowing: **the SF dataset is frozen at 2019-11-28** (that's the
source, not a bug — NYC is current to this week), and the *most recent* SF
inspection is usually an unscored re-visit, so the adapter reports the most
recent inspection that actually carries a score.

---

## Honesty rules

Enforced in code and prompt, because a recommendation people act on has to be
real:

- **No composite star rating exists anywhere.** Verdicts are editorial sentences
  with attributed excerpts. This is both the brand and the Yelp posture.
- **Yelp content** appears only as short attributed excerpts (≤40 words) with
  source links, never blended into a score alongside other sources.
- **Badges only from explicit findings** — an award is never inferred.
- **Health renders only on a confident match**, and the diner view states the
  reality plainly rather than burying it.
- **Charts hide rather than lie** when the data is too thin.
- A failing research agent goes amber; the swarm continues.

---

## Gotchas worth stealing

- **`tsc --noEmit` is a no-op here.** `tsconfig.json` is a solution file
  (`"files": []` + references), so it type-checks nothing and exits 0. Always
  `npm run typecheck`.
- **Tavily `/extract` 403s on yelp.com**, but `/search` with
  `include_raw_content` returns cached Yelp content. `yelp.com/biz/<slug>` is
  chrome; `yelp.com/menu/<slug>/item/<dish>` carries 40–70 verbatim reviews.
- **Don't regex restaurant names out of search titles.** That produced "Best
  Cheap Eats San" and "Francisco" as candidates. Entity extraction is the
  model's job.
- **Socrata `within_circle` silently drops rows with no coordinates**, so the
  health query ORs it with a name `LIKE` clause.

## Known limits

- **OG images are not generated yet.** `renderCardImage` exists and the meta
  tags are set at runtime, but SPA runtime tags don't help real crawlers
  (iMessage, Slack) which don't run JS. A tiny SSR or edge function for `/r/*`
  is the honest fix and is the top item in `HANDOFF.md`.
- **`preindex.ts` has not been run at scale.** It is wired to a live database
  now and is dry-run safe, but the bulk run hasn't happened.
- Health adapters cover SF and NYC only; other cities omit the section entirely
  rather than showing anything.
- React Native / Expo port is explicitly out of scope; this is an installable
  PWA.
