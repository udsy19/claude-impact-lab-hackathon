# Tablestakes — build state

## DEMO READY v5 — 2026-08-08 15:04 PT

v5 was a delivery change, not an analysis change: natural-language front door,
an At-a-Glance hero, progressive disclosure everywhere, and a Diner mode. The
engine underneath is unchanged and still verified.

---

## v5 Definition of Done

- [x] **NL input** resolves messy input to a confirm chip and auto-runs.
      Verified live: `da pio zer in mountain view` → **Doppio Zero · Mountain
      View**, swarm launched on the corrected name. Low confidence waits for a
      tap instead of auto-proceeding.
- [x] **At-a-Glance**: verdict (17 words, under the 20 cap), badges only from
      explicit findings, vitals chips hide when null, photo strip skips
      gracefully at zero images
- [x] **Progressive disclosure** on every section — 14 disclosures; first-render
      scroll cut from 3.58 → **2.63 screens** (see the honest note below)
- [x] **Owner / Diner toggle** re-renders instantly from state; Diner view is
      1.53 screens and `know_before` leads with the Friday collapse — the bad
      news is the first thing a diner reads
- [x] **Ask drawer** built, grounded in the corpus, refuses out-of-corpus
      questions and cites source chips
- [x] **430px mobile frame**; Engine relaid out for it (single column, counter
      first, ticker below — it was a broken desktop grid at first)
- [x] **All charts survive print** — 2 on screen become **3 during print**
      (390×190, 390×220, 390×218), 37 verbatim quotes exposed, all chrome hidden
- [x] `?demo=1` re-captured with the new fields and re-verified offline

### Where I did not hit the number

The DoD asks for **≤2.5 screens** on first render. I got to **2.63** and stopped.
The remaining bulk is the two rating charts (530px) and the pattern list (541px),
both of which §C explicitly says stay visible. Cutting further would mean
overruling that. The lever, if you want it: put the two charts behind one "the
numbers" disclosure — that lands around 2.1.

## v5 bugs found by running it

- **Engine was a desktop grid inside a phone frame** — a two-column layout with
  a 360px sidebar crammed into 430px, cards overlapping. Relaid out.
- **Mention-heat printed blank.** A recharts `ResponsiveContainer` inside a
  `display: none` disclosure measures zero width and emits no SVG. Fixed at the
  source: `Disclosure` now listens for `beforeprint`/`afterprint` and genuinely
  opens, so the chart gets a real box to measure.

## Earlier bugs (v4), kept for the record

- **REVIEWS timed out, returned zero reviews.** One 90-passage call at 16k
  tokens outlived the 75s abort. Chunked into concurrent ~30-passage calls.
- **Paste path dead-ended, then produced a confidently empty brief** — header
  said "46 pieces of evidence", body said "no reviews exist in this dataset".
  `synthesize` read state before React flushed. Evidence now passed explicitly.

All three looked like success at a glance.

## Field notes (validated live against Tavily)

- `/extract` **403s on yelp.com**. `/search` with `include_raw_content` does not.
- `yelp.com/biz/<slug>` is chrome; **`/menu/<slug>/item/<dish>` is the goldmine**
  (40–70 verbatim passages). The pool is priority-sorted before the cap.
- `include_domains` is a **soft** filter — off-list domains are often the best
  material, so nothing is discarded on domain.
- **Images ride the search envelope** as plain URL strings (objects only when
  `include_image_descriptions` is on). Live: REVIEWS 9 unique, PRESS 15, reducer
  caps at 12. `photoTopUp` only fires when a sweep returns none.
- Tavily allows **browser CORS** — the planned Express proxy was never needed.
- **`tsc --noEmit` is a no-op here** (solution-style tsconfig). Use
  `npm run typecheck`.
- Fixture oracle independently re-derived: 46 reviews, 7 quarters, 4.41 → 3.11
  at the planted April 2026 chef change; 58 excerpts verbatim, 0 failures.

## Judgment calls worth knowing

- **The fixture ships zero badges.** A Michelin *listing* is not a star, and an
  Infatuation sentence is not an award — inventing either would have been the
  exact inference the prompt forbids. `[]` also exercises the empty-badge path.
- **The fixture verdict is temporal, not causal** ("since April's kitchen
  change…"). The evidence shows the chef change, the Friday collapse and the
  price rises arrived together; it never establishes the chef caused it.
- **`DEMO_IMAGES` is empty on purpose** — no third-party URLs, so `?demo=1`
  still runs with wifi off, and the photo strip exercises its skip path.

## Known limits, stated plainly

- **Star charts hide on live Yelp runs** — Yelp's cached review text carries no
  star values, so the ≥10-rated threshold trips. Pasted reviews and `?demo=1`
  have stars, so all three charts appear there.
- **Location-aware discovery (§F) was not built**, by instruction. It is the
  roadmap slide.
- Mode B URL ingest remains "coming soon" — Google and Yelp block cross-origin.
- SOCIAL reads captions and articles, not video content.

## Housekeeping

- **Rotate both API keys after the event** — they were shared in chat. Neither
  is in the repo; `.env.local` is gitignored and the pushed tree was audited.
