<div align="center">

# Tablestakes

### Every restaurant has a consultant working for free — their customers.
### This is the tool that reads the report.

**Type a restaurant name. Seven research agents go to work on the open web in parallel.
Ninety seconds later you have a one-page Operator Brief telling you the single
highest-leverage thing to fix this week — and every claim on it is a verbatim
customer quote with the source it came from.**

`React 19` · `TypeScript` · `Vite` · `Tailwind v4` · `Claude Sonnet 4.6` · `Tavily` · `Recharts` · `Framer Motion`

*No backend. No database. No auth. No configuration.*

</div>

---

## The problem nobody solved

Restaurant owners read their reviews one at a time, on their phone, at eleven at
night, emotionally. A bad one ruins the evening. A good one is forgotten by
Tuesday.

Nobody reads a year of them as a **single operational dataset**. Nobody
cross-checks what the customers said against what the critics said. And nobody
tells the owner which of their five problems to fix *first*.

The existing category — "reputation management" — sells a **score that goes
down**. It tells an operator their rating fell to 4.1 and invites them to feel
bad about it. It is a dashboard for a feeling.

**Tablestakes does the opposite.** It never discusses reputation. It reads
reviews as telemetry and returns a decision:

> *"Put a third server and a dedicated host on Friday dinner, starting this
> Friday, and hold it for six weeks."*

A rating is a symptom. A schedule is a lever. This tool only ships levers.

---

## What it actually produced

These are unedited excerpts from **live runs against real restaurants**, not
mockups and not the demo fixture.

### Evvia Estiatorio, Palo Alto — 7/7 agents, 83 reviews, 9 sources

> **THE ONE FIX** — On Monday, pull the tiropita off the line and rebuild the
> filling to a feta-dominant spec — minimum 70% feta to any neutral cheese —
> taste it against the spanakopita (which passed) and the gigantes (which was
> the value leader) before returning it to the menu. Simultaneously, audit
> dolmathes portion count: move from three to five pieces or reduce the $7 price
> to match the actual serving size.

Named dish. Named spec. Named price. Named portion count. **No other
restaurant's owner could mistake that for their own brief** — which is the
actual bar, and it is written into the prompt as a self-check.

### Tamarine, Palo Alto — 38 evidence items, 14 sources

> **Pattern 2** — Papaya salad and garlic noodles are viral on TikTok/Instagram,
> but papaya salad has documented execution issues.

That collision — *social demand meeting operational reality* — is the single
highest-leverage finding this product can produce, and the model found it
unprompted on live data.

It also wrote, about a thinner-evidenced pattern:

> *"single-source but structurally credible at 130-seat volume"*

It flagged its own epistemic footing. That is the behaviour you want from
something an operator is going to act on.

---

## Watch the machine think

The demo is two screens and the contrast between them is the point.

```
   ╔═══════════════════════════════╗          ╔═══════════════════════════════╗
   ║   THE GLASS ENGINE  (dark)    ║   ───►   ║   THE OPERATOR BRIEF (light)  ║
   ╠═══════════════════════════════╣          ╠═══════════════════════════════╣
   ║  seven agent cards, live      ║          ║  the one fix, dominant        ║
   ║  status lines cycling         ║          ║  3–5 patterns, ranked         ║
   ║  source logos landing         ║          ║  rating dip + timeline        ║
   ║  evidence counter climbing    ║          ║  voices · second opinion      ║
   ║  synthesis streaming, token   ║          ║  provenance row of real logos ║
   ║  by token                     ║          ║  print → one clean page       ║
   ╚═══════════════════════════════╝          ╚═══════════════════════════════╝
        you watch it work                          you act on what it found
```

**The engine is not a progress bar.** Agents finish out of order because they
genuinely take different amounts of time. When one fails it goes amber and the
swarm carries on. That texture is real concurrency, not choreography — and the
one time an agent *did* fail on stage-equivalent conditions, it taught us
something (see the war story below).

---

## Quick start

```bash
npm install
cp .env.example .env.local     # add both keys
npm run dev
```

```env
VITE_TAVILY_API_KEY=tvly-...
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

Both APIs are called **straight from the browser** — Tavily permits
cross-origin requests (verified by preflight), and Anthropic is called with
`anthropic-dangerous-direct-browser-access: true`. The planned Express proxy
turned out to be unnecessary and was never built.

| Command | |
|---|---|
| `npm run dev` | dev server |
| `npm run typecheck` | **use this, not bare `tsc --noEmit`** — see the trap below |
| `npm run build` | production build |

**Three ways in:**

| Path | What happens |
|---|---|
| Type a name → **Research** | full live swarm, ~90s |
| **Or paste reviews directly** | Claude parses any messy paste and briefs on it alone |
| `?demo=1` or press **`D`** | replays a captured swarm **offline**, zero network |

---

## Architecture

```
  name + city
       │
       ▼
   runSwarm ────► 7 agents, Promise.allSettled, one 75s global abort
       │          reviews · press · pulse · social · menu · inspector · context
       │
       │          each agent:  Tavily search ──► passage harvest ──► Claude extract
       │                       (concurrent probes)  (dedupe, cap)   (chunked calls)
       ▼
   reducer ─────► a single SwarmState
       │          ↑ this same event stream is what the Engine renders,
       │            so the architecture and the demo are the same object
       ▼
  synthesis ────► streamed Claude call ──► Analysis JSON ──► Operator Brief
```

An "agent" here is deliberately unglamorous: **an async function with a name, a
Tavily strategy, and an extraction prompt**, dispatching lifecycle events into a
reducer. No framework, no orchestration layer, no magic. The honesty of that
design is why the live view is trustworthy — you are watching the actual control
flow.

| Path | Contents |
|---|---|
| `src/swarm/` | `reducer.ts` (pure), `agents.ts` (the seven), `runSwarm.ts` (fan-out + abort) |
| `src/api/` | `tavily.ts` (search, harvest, dedupe), `claude.ts` (incl. SSE streaming) |
| `src/prompts.ts` | every prompt in one file, so they are easy to iterate on |
| `src/lib/stats.ts` | pure statistics — no React, hand-verified against a fixture |
| `src/views/` | `Engine.tsx` (dark, live) · `Brief.tsx` (light, the artifact) |
| `src/fixtures/` | `sample_reviews.ts` (planted-pattern oracle) · `sample_swarm.ts` (offline replay) |

### The seven

| Agent | Job | On failure |
|---|---|---|
| **REVIEWS** | find the Yelp slug, mine menu-item pages, extract verbatim customer voice | amber, partial results kept |
| **PRESS** | critics and guides — Eater, Infatuation, Michelin, James Beard | empty array is a valid answer |
| **PULSE** | discontinuities: chef changes, ownership, closures, renovations | dated findings prioritised |
| **SOCIAL** | TikTok / Instagram / X captions and articles about virality | **honest `quiet`, never invented buzz** |
| **MENU** | prices and signature dishes, to cross-check "overpriced" claims | tier 2, first to be cut |
| **INSPECTOR** | health inspection records | reports a **visible null result** |
| **CONTEXT** | citable industry statistics | falls back to two captured stats |

---

## Why you can trust the output

This is the part that matters. An operator is going to change a schedule
because of this page, so the evidence has to be real. These are enforced in
code and in prompt, not merely encouraged:

| Guarantee | How |
|---|---|
| **Quotes are verbatim** | excerpts must be substrings of source text; each carries its domain. Ctrl-F them against Yelp. |
| **No decorative logos** | the provenance row lists **only domains that actually produced findings** — no Michelin badge on a taqueria Michelin never wrote about |
| **Charts hide rather than lie** | rating distribution needs ≥10 rated reviews; the timeline needs ≥3 buckets. Below that they render nothing and say why |
| **No invented buzz** | SOCIAL returns `quiet` + "no significant social footprint found" when that is the truth |
| **Nulls are visible** | INSPECTOR reports "no public inspection data found" rather than quietly succeeding |
| **Failure is survivable** | one dead agent never kills the swarm; it goes amber and the brief ships without it |
| **Anti-generic self-check** | the synthesis prompt ends: *"could a different restaurant's owner mistake this brief for their own? If yes, regenerate with more specificity."* |

**Verified, not asserted.** The fixture oracle was re-derived by an independent
parser that shares no code with the app: 46 reviews, 7 quarters, average
**4.41 → 3.11** — a 1.30-star dip landing exactly on the planted April 2026 chef
change. All 62 fixture excerpts were confirmed verbatim substrings, zero
failures.

---

## Field notes — what the web actually does

Every one of these was discovered by probing the live APIs, and several
invalidated the original plan. They are the difference between a demo that works
and one that works *on stage*.

- **Tavily `/extract` returns 403 on yelp.com.** The original design was built
  on extracting Yelp pages. It does not work. Do not rebuild it.
- **But Tavily `/search` with `include_raw_content: true` returns cached Yelp
  content.** That is the way in.
- **`yelp.com/biz/<slug>` is a decoy** — ~10,000 characters yielding *two* lines
  of prose. All nav, photo captions and dish thumbnails.
- **`yelp.com/menu/<slug>/item/<dish>` is the goldmine** — 40–70 verbatim
  customer passages per page. Landing those pages is the REVIEWS agent's entire
  job, which is why the passage pool is **priority-sorted before the payload
  cap** — otherwise site chrome starves the good pages.
- **`include_domains` is a soft filter, not a hard one.** Off-list domains come
  back anyway, and they are often the best material (`foodnut.com`,
  `hungryonion.org`), so nothing is ever discarded on domain.
- **Tavily occasionally returns malformed URLs.** `hostOf()` never throws.
- **Measured harvest:** Evvia 219 distinct passages (197 Yelp reviews); Tamarine
  114 passages, 48 first-person.

### The war story

The first live run *looked* like a success. Six agents green. But **REVIEWS was
amber with zero reviews** — it had started its extraction at +14s and a single
90-passage call at 16k `max_tokens` had not returned when the 75-second global
abort fired. The most important agent in the swarm had quietly produced nothing.

The fix was to split extraction into **concurrent ~30-passage calls at 6k
tokens**. Wall clock becomes the slowest chunk instead of the sum, and a failed
chunk costs only its own slice. Re-run: 7/7 settled, 83 reviews.

There was a second one just like it. The paste path rendered a brief whose
header proudly read *"46 pieces of evidence"* while the body said **"no reviews
exist in this dataset."** `synthesize` was reading state synchronously before
React had flushed the dispatch, so the prompt got an empty list. Replies were
unaffected — they run after an `await` — and that asymmetry is what made the bug
visible. Evidence is now passed explicitly rather than depending on render
timing.

**Both bugs looked like success at a glance.** Neither would have been caught by
reading the code.

### One trap worth stealing

`tsconfig.json` here is a **solution file** (`"files": []` + project
references), so a bare `npx tsc --noEmit` type-checks *nothing* and cheerfully
exits `0`. Two "zero errors" readings during this build were therefore
meaningless. Always `npm run typecheck`.

---

## Known limits, stated plainly

Because a tool that hides its edges does not deserve to be trusted at its centre.

- **The star charts hide on live Yelp runs.** Yelp's cached review text carries
  no star values, so the ≥10-rated-reviews threshold trips and the distribution
  and timeline render nothing. Mention heat still draws. Pasted reviews and
  `?demo=1` carry stars, so all three charts appear there. This is the honesty
  rule working as designed, not a rendering bug.
- **URL ingest is not built.** Google and Yelp block cross-origin fetches; the
  field is present and labelled *coming soon* rather than faked.
- **Agent cards show every domain Tavily returns**, including soft-filter noise.
  The Brief's provenance row is stricter — findings-only.
- **Social reads captions, not video.** TikTok and Instagram post text is
  indexed; the video content is not. The agent says `quiet` when that is all
  there is.

---

<div align="center">

**Built for the Claude Impact Lab hackathon.**

*A rating is a symptom. A schedule is a lever. Ship levers.*

</div>
