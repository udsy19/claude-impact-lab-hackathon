# Tablestakes — build state

## V1 SHIPPED — 2026-08-08 22:05 PT

Consumer restaurant-decision app. Runs end to end on the localStorage backend;
every surface below was exercised in a browser, not just compiled.

---

## Definition of Done

| | Item | State |
|---|---|---|
| ✅ | Location grant → or picker that never dead-ends | picker verified on denial |
| ✅ | 4-question flow, multi-select vibe/budget, chat bubbles | verified |
| ⚠️ | 3 suggestions in **< 4s** | **8s** — see below |
| ✅ | Time-of-day + distance filtering | ranker hard-filters both |
| ✅ | `none of these` re-rolls excluding shown | verified |
| ✅ | Sessions logged to `decision_logs` | verified |
| ✅ | Un-indexed → live glass engine → cached second view **instant** | **1006ms, no engine** |
| ✅ | Health: 5 SF restaurants correct; ambiguous → `no_confident_match` | 9/9 live cases |
| ✅ | No composite star rating; excerpts ≤40 words, attributed | enforced in code |
| ✅ | Dossier: At-a-glance, receipts collapsed, grounded chat | verified |
| ✅ | Share `/r/<slug>` renders with correct OG tags | verified |
| ⚠️ | Generated OG **image** | not done — see limits |
| ✅ | Claim captures email into `owner_claims` | verified |
| ⚠️ | Pre-index ≥50 SF with cost log | script + 65-row seed written, **not run** |
| ✅ | PWA manifest + icons, one-handed at 390px | verified |
| ⚠️ | `?demo=1` full offline demo | old dossier fixture only |
| ✅ | README + HANDOFF written | done |

### What the live run actually produced

La Taqueria, cold → verdict *"James Beard–Michelin kitchen running at full demand
with a live labor-history liability and two menu gaps."* 62 evidence, 14 sources,
health matched at score 86, and `know_before` surfacing cash-only, the Monday–
Tuesday closure, **and** a 2017 wage investigation. The hero card then carried
the James Beard and Michelin badges plus the health chip on the next search.

---

## Three items short of the bar, stated plainly

1. **8s to first suggestion, target was <4s.** Candidate discovery from cache is
   fast; the remainder is the single Claude ranking call. Fixes in `HANDOFF.md`
   (stream the hero as it parses, or move the ranker to Haiku).
2. **No Supabase.** The MCP OAuth token expired mid-session after you chose
   "create a new project", so no project exists. Schema, client and migration
   are written; only the localStorage path has been run. This also blocks the
   pre-index run, which needs somewhere to write.
3. **No generated OG image.** Meta tags are set at runtime, which does not help
   crawlers that don't execute JS. Needs a small SSR/edge layer for `/r/*`.

## Bugs found by running it

- **Tavily name seeding produced garbage** — a regex over result titles yielded
  "Best Cheap Eats San" and "Francisco" as restaurant names. Replaced with one
  cheap extraction call.
- **Every search fell through to the network** (16s) because strict vibe+price
  under-filled from the seed. Exhausting the cache first (relax price → widen
  radius) brought it to 8s.
- **Stale "run the check" label** after a dossier was built in-session, because
  candidates were snapshotted at search time. Now re-read on the way back.

## Field notes

- `tsc --noEmit` is a **no-op** here (solution-style tsconfig). Use
  `npm run typecheck`.
- Tavily `/extract` 403s on yelp.com; `/search` with `include_raw_content`
  returns cached Yelp. `/biz/` is chrome, `/menu/<slug>/item/<dish>` is the mine.
- Socrata `within_circle` silently drops rows without coordinates — the health
  query ORs it with a name `LIKE`.
- SF health data is frozen upstream at 2019-11-28; NYC is current.

## Housekeeping

- **Rotate both API keys** — they were shared in chat. Neither is in the repo;
  `.env.local` is gitignored and the pushed tree was audited.
