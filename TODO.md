# Tablestakes — build state

## V1 SHIPPED — 2026-08-09 19:16 PT

Consumer restaurant-decision app. Runs end to end on the localStorage backend;
every surface below was exercised in a browser, not just compiled.

---

## Verified end to end

- **63 SF restaurants pre-indexed for $5.31** (~$0.08 each) → 65 dossiers,
  56 health-matched, 39 carrying badges, 35 avg evidence items.
- **3.57s to three suggestions** against the populated database.
- **122 tests green**; writing them found and fixed a real health-matcher
  false positive.
- **8/8 live health lookups** still correct after that fix (5 SF, Katz's, and
  both ambiguity cases refusing).
- OG storage: bucket public, anon upload 200, public read 200.

---

## Definition of Done

| | Item | State |
|---|---|---|
| ✅ | Location grant → or picker that never dead-ends | picker verified on denial |
| ✅ | 4-question flow, multi-select vibe/budget, chat bubbles | verified |
| ✅ | 3 suggestions in **< 4s** | **3.57s** measured (db 434ms + join 60ms + Haiku rank 3077ms) |
| ✅ | Time-of-day + distance filtering | ranker hard-filters both |
| ✅ | `none of these` re-rolls excluding shown | verified |
| ✅ | Sessions logged to `decision_logs` | verified |
| ✅ | Un-indexed → live glass engine → cached second view **instant** | **1006ms, no engine** |
| ✅ | Health: 5 SF restaurants correct; ambiguous → `no_confident_match` | 9/9 live cases |
| ✅ | No composite star rating; excerpts ≤40 words, attributed | enforced in code |
| ✅ | Dossier: At-a-glance, receipts collapsed, grounded chat | verified |
| ✅ | Share `/r/<slug>` renders with correct OG tags | verified |
| ⚠️ | Generated OG **image** | code + bucket + upload verified; **function not deployed** (Docker) |
| ✅ | Claim captures email into `owner_claims` | verified |
| ✅ | Pre-index ≥50 SF with cost log | **63 indexed, $5.31 total**; 65 dossiers, 56 health-matched |
| ✅ | Supabase live: schema, RLS, seed, logging | 114 rows; claims/logs write-only |
| ✅ | PWA manifest + icons, one-handed at 390px | verified |
| ✅ | `?demo=1` full offline demo | 4 real captured dossiers, ranking stubbed, no network |
| ✅ | README + HANDOFF written | done |

### What the live run actually produced

La Taqueria, cold → verdict *"James Beard–Michelin kitchen running at full demand
with a live labor-history liability and two menu gaps."* 62 evidence, 14 sources,
health matched at score 86, and `know_before` surfacing cash-only, the Monday–
Tuesday closure, **and** a 2017 wage investigation. The hero card then carried
the James Beard and Michelin badges plus the health chip on the next search.

---

## One item short of the bar

**The OG edge function is written but not deployed.** Everything around it is
done and verified: the `og` storage bucket exists and is public, anon upload and
public read both return 200, the function's HTML generation passes 12 adversarial
escaping assertions, and the client renders/uploads the card before creating the
share row (it has to — `share_cards` has no anon UPDATE policy).

The deploy itself is blocked by tooling on this machine, not by the code:
`supabase functions deploy` bundles inside Docker and Docker Desktop is not
running (`docker info` hangs), while the Management API route returns a 500 from
Supabase's own handler. One command once Docker is up:

    supabase functions deploy og --no-verify-jwt --project-ref blgnwtxzvwzepvdziczx

Until then shares fall back to the plain `/r/<slug>` SPA route — the link works,
the unfurl is generic.

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
