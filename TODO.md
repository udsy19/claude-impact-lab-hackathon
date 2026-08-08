# Tablestakes — build state (v4: the research swarm)

## DEMO READY v4 — 2026-08-08 13:12 PT

Verified live, end to end, on two real restaurants with both API keys.

---

## Definition of Done

- [x] `npm run dev` clean; `npm run typecheck` clean; no console errors on the
      happy path (the `NARRATION_CHUNKS` errors in the log were transient HMR
      artifacts while a fixture was mid-write; file is clean, verified)
- [x] Paste drawer parses messy real-world text (Prompt 1)
- [x] REVIEWS agent on a real Palo Alto restaurant: locates the Yelp slug,
      mines menu-item pages, lands **≥15 usable reviews with source chips** —
      **Evvia 83 reviews / 9 sources**, **Tamarine 38 evidence / 14 sources**
- [x] PRESS and PULSE produce findings; INSPECTOR/SOCIAL produce honest nulls
- [x] All agents concurrent; a failing agent never kills the swarm; failures
      show amber (verified twice — once by a real timeout, once by design)
- [x] Engine: statuses cycle, ticker streams, synthesis tokens stream, pattern
      titles materialise mid-stream
- [x] Fixture surfaces ALL planted patterns (Friday service, carnitas, Marisol)
- [x] Real-restaurant briefs are specific and non-generic (see below)
- [x] Every pattern ≥3 verbatim excerpts with per-quote sources; corroboration
      cites both customer and press
- [x] "Why this matters" shows ≥2 attributed stats
- [x] Print view: clean, zero app chrome, charts survive
- [x] `?demo=1` replays the full swarm offline
- [x] Cold run completed as the final action

### Evidence the briefs are not generic

**Evvia** — one fix: *"pull the tiropita off the line and rebuild the filling to
a feta-dominant spec — minimum 70% feta... audit dolmathes portion count: move
from three to five pieces or reduce the $7 price."* Named dishes, a spec, a
price, a portion count.

**Tamarine** — one fix: *"Install a documented expeditor protocol: the kitchen
does not fire all dishes to the pass simultaneously..."* And the social-collision
rule fired unprompted: *"Papaya salad and garlic noodles are viral on
TikTok/Instagram but papaya salad has documented execution issues"* — exactly
the pattern the spec called the highest-leverage finding available.

---

## The one live bug found and fixed

**REVIEWS timed out and returned zero reviews on the first live run.** It began
its extraction at +14s and a single 90-passage call at 16k `max_tokens` had not
finished when the 75s global abort fired — six agents green, the important one
amber and empty.

Fix: chunk the extraction into concurrent ~30-passage calls at 6k tokens
(`REVIEW_CHUNK`). Wall clock becomes the slowest chunk rather than the sum, and
a failed chunk costs only its own slice. Re-run: 7/7 settled, 83 reviews.

## Field notes (validated live against Tavily)

- `/extract` **403s on yelp.com** — the original plan's premise. Do not retry.
- `/search` with `include_raw_content: true` **does** return cached Yelp content.
- `yelp.com/biz/<slug>` is chrome (~10k chars → 2 prose lines).
- `yelp.com/menu/<slug>/item/<dish>` carries 40–70 verbatim passages. Landing
  those is REVIEWS' real job → the pool is priority-sorted before the cap.
- `include_domains` is a **soft** filter; off-list domains are often the best
  material, so nothing is discarded on domain.
- Tavily returns malformed URLs sometimes → `hostOf()` never throws.
- **Tavily allows browser CORS** (preflight returns the origin + `authorization`),
  so the planned Express proxy was never needed.
- **`tsc --noEmit` is a no-op here** — `tsconfig.json` is a solution file.
  Use `npm run typecheck`. Two earlier "clean" readings were vacuous.
- Fixture oracle independently re-derived: 46 reviews, 7 quarters,
  4.41 → 3.11 (1.30-star dip) at the planted April 2026 chef change; 62
  excerpts confirmed verbatim.

## Known limits, stated honestly

- **Star charts hide on live Yelp runs.** Yelp's cached review text carries no
  star values, so `ratedCount < 10` trips the honesty rule and the rating
  distribution and timeline hide themselves rather than lie. Mention heat still
  renders. The `?demo=1` fixture has stars, so all three charts show there.
- Mode B (URL fetch) remains "coming soon" — Google and Yelp block cross-origin.
- Agent cards show every domain discovered, including Tavily's soft-filter noise
  (e.g. appointmenttrader.com). The Brief's provenance row is stricter: it lists
  only domains that actually produced findings.
