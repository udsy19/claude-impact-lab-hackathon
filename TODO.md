# Tablestakes — build state (v4: the research swarm)

## BLOCKER — no Anthropic key
`.env.local` has `VITE_TAVILY_API_KEY` (live, verified). It does **not** have
`VITE_ANTHROPIC_API_KEY`. Every extraction and synthesis call is therefore
unverified. To unblock:

    echo 'VITE_ANTHROPIC_API_KEY=sk-ant-...' >> .env.local   # then restart dev server

Everything below marked (claude) cannot be checked until then.

## Empirical findings from live Tavily probing (2026-08-08)
These reshaped the architecture and are worth keeping:
- Tavily **/extract 403s on yelp.com**. The v3 plan's "extract the Yelp page"
  premise does not work. Do not retry it.
- Tavily **/search with `include_raw_content: true` DOES return cached Yelp
  content** — this is the way in.
- Yelp **`/biz/<slug>` pages are empty** — ~10k chars of nav, 2 prose lines.
- Yelp **`/menu/<slug>/item/<dish>` pages carry full verbatim reviews** —
  40–70 prose passages each. This is the mine, and the REVIEWS agent's real job
  is getting those pages into the result set.
- `include_domains` is a **soft** filter; off-list domains still return (which
  surfaced foodnut.com and hungryonion.org — useful, kept).
- Tavily sometimes returns **malformed URLs** — `hostOf()` never throws.

Measured harvest: Evvia Estiatorio → 219 distinct passages (197 Yelp reviews).
Tamarine → 114 passages, 48 first-person; its Yelp hits were the menu index, so
press carried it. Both clear the ≥15-review bar.

## Done
- [x] Deps: framer-motion, react-markdown, lucide-react, canvas-confetti, recharts
- [x] `src/sources.ts` — DOMAINS, QUERIES (rewritten around the findings above),
      PRESTIGE_ORDER + byPrestige, FALLBACK_STATS
- [x] `src/types.ts` — SwarmEvent/SwarmState/Analysis/KeyReview/SocialPulse
- [x] `src/api/tavily.ts` — search, extract, passages, looksLikeReview, yelpSlug,
      hostOf (guarded)
- [x] `src/api/claude.ts` — complete, **completeStream (SSE)**, parseJSON, retry
- [x] `src/prompts.ts` — PARSE, REVIEW_EXTRACT, FINDINGS_EXTRACT (+PRESS/PULSE
      lenses), SOCIAL_EXTRACT, CONTEXT_EXTRACT, SYNTHESIZE (streamed, with
      key_reviews + corroboration + the social-collision rule), REPLIES
- [x] `src/components/SourceChip.tsx` + `favicon()` — Google s2 favicons,
      lucide globe fallback on error
- [x] `src/index.css` — light + dark tokens, agent pulse, print stylesheet
      (charts get break-inside: avoid; recharts overflow forced visible)
- [x] `src/views/Engine.tsx` — agent grid, live status + timestamped log,
      accumulating source chips, evidence ticker w/ live micro-stats,
      streaming synthesis pane
- [x] `src/components/PasteDrawer.tsx` — slide-out, load sample, parse (claude)
- [x] `src/views/Brief.tsx` — provenance row, ONE FIX, chart band, patterns,
      Voices, mention heat, delta + likely cause, second opinion, bright spots,
      social pulse strip, why-this-matters, replies accordion, print
- [x] `src/App.tsx` — phase machine, live run, streamed synthesis, mid-stream
      pattern titles, `?demo=1` + hidden `D` hotkey replay, confetti reveal

## In flight (parallel agents)
- [ ] `src/lib/stats.ts` + charts (RatingDistribution, RatingOverTime, MentionHeat)
- [ ] `src/swarm/{reducer,agents,runSwarm}.ts`
- [ ] `src/fixtures/{sample_reviews,sample_swarm}.ts` (v4: 5+ quarters, April 2026
      chef change with a real rating dip)

## Remaining
- [ ] tsc clean after integration
- [ ] `?demo=1` offline replay verified in browser
- [ ] Charts verified in print preview
- [ ] (claude) live run on 2 real restaurants, planted-pattern read-through ×2
- [ ] DEMO_SCRIPT.md refresh for the swarm narrative
