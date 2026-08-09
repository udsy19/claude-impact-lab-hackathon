# Tablestakes — 75-second demo

**Setup before you walk up.** `npm run dev`, browser full-screen on the start
screen, nothing typed. Note the port Vite prints — it is 5173 unless that is
already taken. Second tab pre-loaded on `?demo=1` — don't mention it
exists. Know your restaurant: something on University Ave with real Yelp volume
and at least one press mention. Evvia Estiatorio is the reliable one (219
evidence passages, Michelin + Infatuation coverage). Tamarine also works.

The app renders as a phone. Say "this is the mobile build" — it is.

---

**0:00 — Start screen. Type it badly, on purpose.**

Type `da pio zer in mountain view` — misspelled, lowercase, no punctuation.

> "Every restaurant owner reads their reviews. One at a time, on their phone, at
> eleven at night, emotionally. Nobody reads a year of them as one operational
> dataset — and nobody cross-checks them against what the critics said."

**0:08 — It self-corrects on screen: `Doppio Zero · Mountain View ✓`** and starts
on its own after a beat.

> "You don't have to know how it's spelled. You just have to know where you ate."

**0:12 — The swarm lights up.** Don't narrate the mechanics; narrate
the stakes. Let the cards do the work.

> "Seven researchers just went to work on this restaurant. They're reading a year
> of customers, every critic in town, the local news, and social — all in
> parallel, right now."

Point at a card mid-flight. The status lines are real: `searching yelp.com…`,
`reading 5 pages…`, `extracting reviews…`, and the source logos landing on each
card as it discovers where the evidence lives.

> "Watch the logos land. That's each agent finding out where the evidence
> actually is. Nobody told it to look at Michelin — it went and found it."

**0:30 — One agent goes amber.** Don't skip past it. Own it.

> "That one found nothing and said so. It didn't make something up. That matters
> more than the six that worked."

**0:38 — Evidence counter climbs; synthesis pane opens and starts streaming.**

> "Now it's reasoning over all of it at once — and you're watching it think."

Let it stream for a real beat. Say nothing for three seconds.

**0:52 — Cut to the brief.** Light mode, confetti, silence. Let them read THE ONE
FIX on their own.

> "One page. The single highest-leverage change to make this week. Every claim
> underneath it is a verbatim customer quote with the source it came from."

**1:02 — Scroll once** through the rating dip and the pattern cards.

> "The rating didn't drift — it stepped down. And the news agent found a chef
> change on the same date. Neither half of that is interesting alone."

**1:05 — Flip the toggle to Diner.** Same evidence, second audience.

> "Same corpus, one toggle. The owner gets the fix. The diner gets: should you
> go, what to order, what to skip, and — this is the part the discovery apps
> won't do — the bad news, up front."

**1:15 — Flip back to Owner and hit Print.** Let the dialog open.

> "This is the page the owner opens Monday."

*(Escape out. Done.)*

---

## If live fails

Wifi, rate limit, a restaurant with no footprint — don't debug on stage. Switch
to the pre-loaded tab (or press `D` on the start screen):

> "Wifi's being wifi — same run, twenty minutes ago."

Then pick up at **0:12**. `?demo=1` replays the entire captured swarm with real
timing, offline: same agents, same out-of-order finishes, same amber failure,
same streamed synthesis, same brief.

## Questions you'll get

- **"Are those real agents or a progress bar?"** — Real. Each is an async worker
  with its own search strategy and its own extraction prompt, running under
  `Promise.allSettled`. The out-of-order finishes and that amber failure are
  what concurrency actually looks like.
- **"Is this just sentiment analysis?"** — No. Sentiment gives you a number that
  goes down. This gives you a shift you can staff against: Friday dinner, two
  servers, started in May.
- **"Could it invent a quote?"** — Every excerpt is constrained to be a verbatim
  substring of source text, and each carries the domain it came from. Ctrl-F
  them against Yelp.
- **"Why not just ask ChatGPT?"** — It doesn't have this restaurant's last
  fourteen months of Yelp reviews, and it won't tell you which of five problems
  to fix first or why that one beat the other four.
