# Tablestakes — build state

## DEMO READY v4 — 2026-08-08 13:52 PT

Pushed to `origin/main`. Verified live on two real restaurants, plus the paste
path and the offline replay. No API key is in the repo or its history.

---

## Definition of Done

- [x] `npm run dev` clean; `npm run typecheck` clean; no console errors on the
      happy path
- [x] Paste drawer parses messy real-world text (Prompt 1, live)
- [x] REVIEWS agent on real restaurants: locates the Yelp slug, mines menu-item
      pages, ≥15 usable reviews with source chips —
      **Evvia 83 reviews / 9 sources**, **Tamarine 38 evidence / 14 sources**
- [x] PRESS + PULSE produce findings; SOCIAL + INSPECTOR produce honest nulls
- [x] Agents concurrent; a failure never kills the swarm; amber states verified
      twice (once by a genuine timeout, once by fixture design)
- [x] Engine: statuses cycle, ticker streams, synthesis streams token by token,
      pattern titles materialise mid-stream
- [x] Fixture surfaces ALL planted patterns
- [x] Real-restaurant briefs specific and non-generic
- [x] Every pattern ≥3 verbatim excerpts with per-quote sources; corroboration
      cites both customer and press
- [x] "Why this matters" shows ≥2 attributed stats
- [x] Print view clean, zero app chrome, charts survive
- [x] `?demo=1` replays the full swarm offline
- [x] **Cold run completed as the final action** — mid-flight 6/7 settled with
      the amber failure visible; final brief 38 evidence / 11 sources,
      3 charts, 4 patterns, 33 verbatim quotes

### Planted patterns recovered through the LIVE pipeline

Not the fixture replay — Prompt 1 parse followed by Prompt 2 synthesis on a
pasted blob. All five, with correct trends:

1. Carnitas tacos dry/lukewarm, $22–$24 — stable
2. Friday dinner collapse since May 2026, 25–90 min waits — worsening
3. Kitchen change late April 2026 (inferred from symptoms alone) — worsening
4. Price increases vs shrinking portions — worsening
5. Marisol named in 9 reviews — bright spot

---

## Bugs found by running it, not reading it

**1. REVIEWS timed out and returned zero reviews.** Extraction began at +14s and
a single 90-passage call at 16k `max_tokens` had not returned when the 75s
global abort fired — six agents green, the important one amber and empty.
Fixed by chunking into concurrent ~30-passage calls at 6k tokens. Re-run: 7/7,
83 reviews.

**2. Paste path dead-ended, then produced a confidently empty brief.** From the
start screen the drawer dispatched reviews and stopped. After wiring it through,
the brief's header read "46 pieces of evidence" while the body read "no reviews
exist in this dataset" — `synthesize` read `stateRef` before React flushed the
dispatch. Evidence is now passed explicitly. Replies were unaffected because
they run after an `await`; that asymmetry is what exposed it.

Both looked like success at a glance.

---

## Field notes (validated live against Tavily)

- `/extract` **403s on yelp.com** — the original plan's premise. Do not retry.
- `/search` with `include_raw_content: true` **does** return cached Yelp content.
- `yelp.com/biz/<slug>` is chrome (~10k chars → 2 prose lines).
- `yelp.com/menu/<slug>/item/<dish>` carries 40–70 verbatim passages. Landing
  those is REVIEWS' real job → the pool is priority-sorted before the cap.
- `include_domains` is a **soft** filter; off-list domains are often the best
  material, so nothing is discarded on domain.
- Tavily returns malformed URLs sometimes → `hostOf()` never throws.
- **Tavily allows browser CORS**, so the planned Express proxy was never built.
- **`tsc --noEmit` is a no-op here** — `tsconfig.json` is a solution file.
  Use `npm run typecheck`. Two earlier "clean" readings were vacuous.
- Fixture oracle independently re-derived: 46 reviews, 7 quarters,
  4.41 → 3.11 (1.30-star dip) at the planted April 2026 chef change;
  62 excerpts confirmed verbatim.

## Known limits, stated honestly

- **Star charts hide on live Yelp runs.** Yelp's cached review text carries no
  star values, so the ≥10-rated threshold trips and the rating distribution and
  timeline render nothing rather than lying. Mention heat still draws. Pasted
  reviews and `?demo=1` have stars, so all three charts appear there.
- Mode B (URL fetch) remains "coming soon" — Google and Yelp block cross-origin.
- Agent cards show every domain Tavily returns, including soft-filter noise. The
  Brief's provenance row is stricter: findings-only.
- SOCIAL reads captions and articles, not video content.

## Housekeeping

- Rotate both API keys after the event — they were shared in chat. Neither is in
  the repo (`.env.local` is gitignored; pushed tree audited).
- `DEMO_SCRIPT.md` and `README.md` no longer hardcode a port; Vite prints it
  (5173 unless taken).
