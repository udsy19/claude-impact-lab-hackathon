# Handoff

State as of 2026-08-08. The app runs end to end on the localStorage backend;
every surface in the build prompt exists and has been exercised in a browser.

## Do these first

1. **Connect Supabase.** The blocker was mechanical, not technical: the MCP
   OAuth token expired mid-session, so no project was ever created. Everything
   is ready — apply `supabase/migrations/0001_init.sql`, set `VITE_SUPABASE_URL`
   and `VITE_SUPABASE_ANON_KEY`, and `src/db/index.ts` switches backends with no
   other change. The Supabase store is fully implemented but has **never been
   run against a live database**, so expect to shake out one or two PostgREST
   details (the `price_tier` null `.or()` filter and the embedded
   `shareCardBySlug` join are the two most likely).

2. **Run the pre-index.** `npx tsx scripts/preindex.ts seed/sf.json --limit 5`
   first to watch the cost log, then the full 65. It is resumable and aborts any
   restaurant over $1.50. Without a database it runs dry and persists nothing.
   Then write `seed/nyc.json` (60 equivalents) and run that.

3. **Fix OG images properly.** `renderCardImage()` (html-to-image) and
   `setOgTags()` exist, but runtime meta tags do not help iMessage, Slack or
   Twitter — those crawlers do not execute JS. The real fix is a small edge
   function or prerender for `/r/*` that returns static OG tags plus a generated
   1200×630 PNG stored in Supabase storage. **The share card is the growth loop,
   so this is worth more than any new feature.**

## Known issues

- **Time to first suggestion is ~8s, not the <4s target.** Breakdown: candidate
  discovery from the local cache is fast; the remainder is the single Claude
  ranking call. Options, cheapest first: stream the hero card as soon as the
  first suggestion parses out of the ranking response; drop the ranker to
  `claude-haiku-4-5` (this is a pick-3-from-30 task, not deep reasoning); or
  render distance-sorted candidates instantly and let the ranked order swap in.
- **Overpass is slow (5–10s) when it fires.** It only fires in genuinely thin
  areas now, but a pre-indexed city avoids it entirely — another reason to run
  the pre-index.
- **`?demo=1` is not wired for the new decision flow.** The old dossier fixtures
  still exist in `src/fixtures/sample_swarm.ts`; a full offline decision session
  needs a captured candidate set + 3 dossiers seeded into the local store. The
  local seeder (`src/fixtures/seedLocal.ts`) is most of the way there.
- **SF health data is frozen at 2019-11-28** upstream. Consider showing the
  inspection date more prominently in the UI so it doesn't read as current.
- No tests. The health matcher and `src/lib/stats.ts` are pure and are the two
  places where a bug would be silent and harmful — start there.

## Next features, in the order I'd build them

1. **Saved lists** — `decision_logs` already records every session keyed by
   device id; a "been / want to go" list is a small step and is the retention
   hook.
2. **Owner dashboard** — `owner_claims` is capturing emails now. Validate demand
   from that list before building anything.
3. **Location-aware discovery** ("rising / falling near you") — this is the
   endgame: run the engine continuously across a city and trend detection writes
   itself from evidence rather than check-ins. Needs the pre-index at scale.
4. **Expo port** — deliberately out of scope. The app is a PWA and installs to a
   home screen; port when the web version has retention worth carrying over.

## Things not to undo

- The cache-first ordering in `findCandidates` (relax price → widen radius →
  *then* network). It is the cost model, not an optimisation.
- The health matcher's distance gate. It refuses rather than guesses; a wrong
  grade on the wrong restaurant is the worst error this product can make.
- The absence of any composite star rating. That is deliberate, legally and
  editorially.
