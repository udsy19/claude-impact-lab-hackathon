/**
 * OFFLINE REPLAY FIXTURE — `?demo=1`
 *
 * A complete recorded swarm run for Casa Verde (Palo Alto), replayable with
 * zero network. `DEMO_EVENTS[i].at` is milliseconds after swarm start; a
 * runner just sleeps to each `at` and dispatches `event`.
 *
 * Story the timeline tells (DEMO_EVENTS spans 0 → 18.0s):
 *   0.0s  swarm/start, all seven agents spawn staggered 150–700ms apart
 *   6.0s  press finishes first (few pages, high signal)
 *   6.9s  menu finishes
 *   8.0s  inspector FAILS — amber card, swarm keeps going
 *   9.0s  social finishes
 *  10.5s  context finishes
 *  12.0s  pulse finishes — it is the one that surfaces the April chef change
 *  17.0s  reviews finishes last (38 reviews, 4 sources, most work)
 *  18.0s  synthesis/start — LAST event
 *
 * The events stop at `synthesis/start` on purpose. App.tsx's `runDemo` takes
 * over from there: it types DEMO_NARRATION out as synthesis/token chunks and
 * then dispatches `synthesis/done` with DEMO_ANALYSIS itself. Emitting those
 * here too would double-render the narration. End-to-end the demo runs about
 * 27s (18.0s swarm + ~8s narration typing + reveal).
 *
 * CONSISTENCY CONTRACT
 *   Every `excerpts` / `evidence` string in DEMO_ANALYSIS, and every
 *   `kind: "review"` evidence item below, is a VERBATIM substring of
 *   SAMPLE_REVIEWS (and therefore of some DEMO_REVIEWS[i].text).
 *   Press/pulse/social evidence is agent-authored prose and intentionally
 *   is not drawn from the review blob. So are `verdict` and `diner_view` —
 *   those are conclusions about the corpus, not quotations from it.
 *
 * DEMO_REVIEWS is the 38-review subset the swarm "found" out of the 46 in the
 * blob. Its stars reproduce the planted April 2026 dip:
 *   before 2026-04-01 : 19 reviews, star sum 83 → avg 4.37
 *   on/after 2026-04-01: 19 reviews, star sum 59 → avg 3.11
 */
import type {
  Analysis,
  ContextStat,
  EvidenceItem,
  Finding,
  ParsedReview,
  SocialPulse,
  SwarmEvent,
} from "../types";

export const DEMO_RESTAURANT = "Casa Verde";
export const DEMO_CITY = "Palo Alto";

// The offline fixture deliberately ships no photos, so the Brief's photo strip
// exercises its graceful-skip path (and `?demo=1` still works with wifi off).
export const DEMO_IMAGES: string[] = [];

// ---------------------------------------------------------------------------
// Reviews the swarm collected
// ---------------------------------------------------------------------------

export const DEMO_REVIEWS: ParsedReview[] = [
  {
    date: "2025-03-08",
    stars: 5,
    source: "yelp.com",
    text: "Been coming here since they opened. The al pastor is the best on University Ave, full stop. Marisol remembered our anniversary from last year and brought out a flan with a candle in it. That's not something you can train.",
  },
  {
    date: "2025-03-19",
    stars: 4,
    source: "yelp.com",
    text: "Solid neighborhood spot. Salsa flight is genuinely great. Carnitas tacos were a little dry but the al pastor made up for it.",
  },
  {
    date: "2025-04-09",
    stars: 3,
    source: "yelp.com",
    text: "The carnitas tacos came out lukewarm and honestly kind of greasy. Everything else was fine. My wife's enchiladas were excellent.",
  },
  {
    date: "2025-04-22",
    stars: 5,
    source: "tripadvisor.com",
    text: "Marisol took care of us and she is a total pro. Knew every single item, steered us away from something I would have ordered and been disappointed by. Great instinct.",
  },
  {
    date: "2025-05-06",
    stars: 5,
    source: "opentable.com",
    text: "Birthday dinner for 8 and they handled it beautifully. Everything came out at once and hot. Room is loud but in a good way.",
  },
  {
    date: "2025-06-11",
    stars: 2,
    source: "yelp.com",
    text: "Ordered the carnitas tacos on a recommendation and they were dry as sawdust. Tasted like they'd been sitting in a warmer. For $19 I expected better. The chips and salsa were great though.",
  },
  {
    date: "2025-07-02",
    stars: 5,
    source: "yelp.com",
    text: "My go-to for a weeknight dinner. Never had a bad meal. Staff genuinely seem to like working here which you can feel.",
  },
  {
    date: "2025-08-05",
    stars: 5,
    source: "opentable.com",
    text: "Marisol again. Third time she's served us and every time she nails the pacing — apps land, plates cleared, drinks refilled without being asked. Whoever trained her, keep them.",
  },
  {
    date: "2025-08-23",
    stars: 4,
    source: "tripadvisor.com",
    text: "Really good. The mole is a sleeper hit, order it. Skip the carnitas tacos, they were dry both times I've tried them.",
  },
  {
    date: "2025-09-14",
    stars: 5,
    source: "opentable.com",
    text: "Family dinner with the in-laws and it was flawless. Out in an hour, everyone happy.",
  },
  {
    date: "2025-10-06",
    stars: 3,
    source: "yelp.com",
    text: "Fine. Not amazing. Carnitas were tough. Room was freezing near the door.",
  },
  {
    date: "2025-10-15",
    stars: 5,
    source: "yelp.com",
    text: "This is a real restaurant, not a Cal Ave tourist trap. The kitchen knows what it's doing. Marisol runs the floor like a conductor.",
  },
  {
    date: "2025-10-24",
    stars: 4,
    source: "reddit.com",
    text: "Great tacos (get the al pastor, not the carnitas). Fast on a Wednesday. Good value for University Ave.",
  },
  {
    date: "2025-11-02",
    stars: 5,
    source: "tripadvisor.com",
    text: "Lovely dinner. The margarita program is underrated. Only note is the carnitas came out cold in the middle, which the server fixed immediately no argument.",
  },
  {
    date: "2025-12-04",
    stars: 5,
    source: "yelp.com",
    text: "Marisol is the reason we keep coming back. She remembers our kid's name. Food is great but the service is what makes it.",
  },
  {
    date: "2026-01-07",
    stars: 3,
    source: "yelp.com",
    text: "Carnitas tacos again disappointed — dry and a bit stringy. I keep hoping. Everything else on the menu is strong.",
  },
  {
    date: "2026-02-18",
    stars: 5,
    source: "opentable.com",
    text: "Friday night and the room was completely full, but we were seated on time and had drinks in five minutes. Whatever their system is, it works. Al pastor and the margarita flight, no notes.",
  },
  {
    date: "2026-03-03",
    stars: 5,
    source: "tripadvisor.com",
    text: "The mole is the best thing on the menu and nobody talks about it. Carnitas tacos were dry again, which is the one consistent miss, but everything else was perfect.",
  },
  {
    date: "2026-03-19",
    stars: 5,
    source: "yelp.com",
    text: "Weeknight regular. Always fast, always good.",
  },

  // ---- Chef Danny Reyes takes over the kitchen, April 2026 ----

  {
    date: "2026-04-02",
    stars: 3,
    source: "yelp.com",
    text: "Prices have crept up. $22 for three carnitas tacos that were, once again, dry. The al pastor is still worth it but I noticed the plate looked smaller than I remember.",
  },
  {
    date: "2026-04-08",
    stars: 5,
    source: "opentable.com",
    text: "Marisol! Best server in Palo Alto. She had our drinks on the table before we sat down.",
  },
  {
    date: "2026-04-16",
    stars: 3,
    source: "yelp.com",
    text: "Food's still good but it's gotten expensive for what it is. The enchilada plate went from two to what feels like one and a half. Twenty-six dollars is a lot for that.",
  },
  {
    date: "2026-04-23",
    stars: 3,
    source: "tripadvisor.com",
    text: "Nice dinner but something changed in the kitchen. The mole was thinner than I remember and the rice was underseasoned. A little pricey now too. Carnitas were dry, ordered the al pastor for my second taco and it was much better.",
  },
  {
    date: "2026-04-29",
    stars: 2,
    source: "yelp.com",
    text: "We've eaten here maybe forty times in three years and this was the first genuinely bad meal. The kitchen feels different — the seasoning is off, the carnitas were dry and the al pastor came out overcooked. I don't know what happened but something did.",
  },
  {
    date: "2026-05-08",
    stars: 2,
    source: "yelp.com",
    text: "Came in on a Friday at 7:30 and waited 25 minutes just to have someone take our drink order. Food took nearly an hour. The room was packed and clearly understaffed — I counted two servers for the whole floor. Food was good when it finally came but I've never seen it like this here.",
  },
  {
    date: "2026-05-15",
    stars: 3,
    source: "reddit.com",
    text: "Friday night is rough now. Long wait, harried staff, apps and mains arrived at the same time. We've been coming for two years and this is new.",
  },
  {
    date: "2026-05-21",
    stars: 5,
    source: "yelp.com",
    text: "Went on a Tuesday and it was the Casa Verde I know — relaxed, quick, delicious. Marisol was working and everything ran like clockwork.",
  },
  {
    date: "2026-05-29",
    stars: 2,
    source: "yelp.com",
    text: "Second Friday in a row where service completely fell apart. Waited 40 minutes for food, then two of the four plates came out cold. The carnitas tacos were dry, which at this point I think is just how they make them. And it was $88 for two people with one round of drinks.",
  },
  {
    date: "2026-06-04",
    stars: 4,
    source: "tripadvisor.com",
    text: "Went early on a Thursday to avoid the crowds and it was great. I'd avoid Friday based on what friends have told me.",
  },
  {
    date: "2026-06-12",
    stars: 2,
    source: "yelp.com",
    text: "Friday dinner, 8pm. Nobody greeted us for ten minutes at the host stand. Once seated it was another twenty before a server appeared. This place used to be tight. Food still good, service is not.",
  },
  {
    date: "2026-07-02",
    stars: 3,
    source: "reddit.com",
    text: "Prices are getting hard to justify. $24 for the carnitas plate and it was dry again. I'll still come for the al pastor but I'm coming less.",
  },
  {
    date: "2026-07-05",
    stars: 2,
    source: "yelp.com",
    text: "Friday night again. Ninety minutes from door to entree. The two servers on the floor were sprinting and apologizing constantly — this is a staffing problem, not a them problem. Felt bad for them honestly.",
  },
  {
    date: "2026-07-08",
    stars: 3,
    source: "opentable.com",
    text: "Marisol is still fantastic. Came on a Wednesday and it was smooth. Carnitas tacos remain the one miss on an otherwise excellent menu — dry, every single time. Docking a star because two apps and two entrees came to ninety-four dollars.",
  },
  {
    date: "2026-07-11",
    stars: 5,
    source: "yelp.com",
    text: "Weekday lunch is still the best deal on University. In and out in 35 minutes.",
  },
  {
    date: "2026-07-18",
    stars: 3,
    source: "tripadvisor.com",
    text: "Good food, painful Friday service, and prices that have quietly gone up maybe 20% in a year. The kitchen feels different than it did last year too. Two of those three I can live with.",
  },
  {
    date: "2026-07-25",
    stars: 4,
    source: "yelp.com",
    text: "Tuesday night, no issues at all, food was hot and fast. Whatever is happening on Fridays isn't happening the rest of the week.",
  },
  {
    date: "2026-07-31",
    stars: 2,
    source: "yelp.com",
    text: "Friday, 7pm, forty-five minute wait for a table we'd reserved. Then slow service on top of that. I love this place and I'm frustrated writing this.",
  },
  {
    date: "2026-08-04",
    stars: 3,
    source: "tripadvisor.com",
    text: "The al pastor is still one of my favorite things in Palo Alto. But $26 for the plate, and the carnitas tacos my partner ordered were dry and lukewarm. Went on a Friday and waited a long time. Mixed feelings.",
  },
];

// ---------------------------------------------------------------------------
// Findings, social, context
// ---------------------------------------------------------------------------

const PRESS_FINDINGS: Finding[] = [
  {
    finding:
      "Eater SF reported a kitchen leadership change at Casa Verde that lines up exactly with the ratings dip.",
    quote:
      "Casa Verde has quietly handed the line to Danny Reyes, formerly of Loló, who took over the kitchen in April.",
    source: "eater.com",
    url: "https://sf.eater.com/casa-verde-danny-reyes",
    date: "2026-04-27",
  },
  {
    finding:
      "The Infatuation's Peninsula guide still lists Casa Verde as a neighborhood standby, but the entry was last refreshed before the chef change.",
    quote:
      "Still the most reliable weeknight Mexican on University Ave, and the al pastor is the reason.",
    source: "theinfatuation.com",
    url: "https://www.theinfatuation.com/sf/reviews/casa-verde",
    date: "2025-11-12",
  },
  {
    finding:
      "Casa Verde holds a Michelin Guide listing (no star, no Bib) — recognition that raises expectations against the current 3.1 average.",
    quote: null,
    source: "guide.michelin.com",
    url: "https://guide.michelin.com/us/en/california/palo-alto/restaurant/casa-verde",
    date: "2025-06-02",
  },
];

const PULSE_FINDINGS: Finding[] = [
  {
    finding:
      "Palo Alto Online's restaurant column confirms the April 2026 chef change and names the incoming chef.",
    quote:
      "Chef Danny Reyes started at Casa Verde in early April, taking over from founding chef-owner Elena Cortez, who has stepped back to run the business side.",
    source: "paloaltoonline.com",
    url: "https://www.paloaltoonline.com/eating/casa-verde-chef-change",
    date: "2026-04-11",
  },
  {
    finding:
      "Casa Verde has had a front-of-house job posting open continuously since late April 2026 — corroborates the reviewers' understaffing read.",
    quote: "Now hiring: PM servers, Thu–Sun. Immediate start.",
    source: "paloaltoonline.com",
    url: "https://www.paloaltoonline.com/jobs/casa-verde-servers",
    date: "2026-04-24",
  },
  {
    finding:
      "The Mercury News covered a Peninsula-wide restaurant staffing squeeze this summer, with University Ave named specifically.",
    quote:
      "Operators on University Avenue say they are running Friday and Saturday dinner two servers short of where they were a year ago.",
    source: "mercurynews.com",
    url: "https://www.mercurynews.com/peninsula-restaurant-staffing-2026",
    date: "2026-06-30",
  },
  {
    finding:
      "No health, permit, or ownership filings appear against Casa Verde in the same window — the change is culinary, not regulatory.",
    quote: null,
    source: "paloaltoonline.com",
    date: null,
  },
];

const SOCIAL_PULSE: SocialPulse = {
  buzz_level: "steady",
  driving_it:
    "The al pastor is still doing the marketing — two TikToks with a combined 190k views are taco-only. But the newest wave of comments is about the wait, and one Instagram Reel comment thread has turned into people comparing Friday wait times.",
  mentions: [
    {
      platform: "tiktok",
      gist: "Taco-cam clip of the al pastor coming off the trompo, 140k views, overwhelmingly positive comments.",
      quote: "palo alto has no business having al pastor this good",
      dish_or_topic: "al pastor",
      url: "https://www.tiktok.com/@bayareabites/video/casa-verde-al-pastor",
    },
    {
      platform: "tiktok",
      gist: "A 'Palo Alto date night' round-up puts Casa Verde second, with a caveat about the wait.",
      quote: "go on a weekday tho, friday is a war zone rn",
      dish_or_topic: "wait times",
      url: "https://www.tiktok.com/@peninsulaeats/video/palo-alto-date-night",
    },
    {
      platform: "instagram",
      gist: "Reel of the salsa flight; the comment thread drifted into people trading Friday wait times.",
      quote: "waited 50 min last friday and we had a reservation 😭",
      dish_or_topic: "wait times",
      url: "https://www.instagram.com/reel/casa-verde-salsa-flight",
    },
    {
      platform: "instagram",
      gist: "Local food account posted about the mole; several commenters said it tastes different lately.",
      quote: "is it just me or did the mole change",
      dish_or_topic: "mole",
      url: "https://www.instagram.com/p/casa-verde-mole",
    },
    {
      platform: "tiktok",
      gist: "A server-side POV video from a former Casa Verde employee, oblique but widely shared locally.",
      quote: "when there's two of you on a full friday floor",
      dish_or_topic: "staffing",
      url: "https://www.tiktok.com/@serverlife/video/two-on-a-friday",
    },
    {
      platform: "instagram",
      gist: "Marisol tagged by name in a customer's story repost; the restaurant reshared it.",
      quote: "ask for marisol, she runs that room",
      dish_or_topic: "Marisol",
      url: "https://www.instagram.com/stories/casa-verde-marisol",
    },
  ],
};

const CONTEXT_STATS: ContextStat[] = [
  {
    stat: "Median dinner entrée on University Ave rose from $24 to $28 between 2025 and 2026 — Casa Verde's $26 enchilada plate is at market, but its reviewers did not experience it that way.",
    source: "mercurynews.com",
  },
  {
    stat: "Full-service restaurant employment in San Mateo and Santa Clara counties is still 6% below its 2019 level as of Q2 2026.",
    source: "bls.gov",
  },
  {
    stat: "Friday 6–9pm is the single highest-covers window for Palo Alto full-service restaurants, averaging 31% of weekly dinner covers.",
    source: "opentable.com",
  },
  {
    stat: "A one-star drop in average rating correlates with a 5–9% revenue decline for independent restaurants.",
    source: "hbs.edu",
  },
];

// ---------------------------------------------------------------------------
// Evidence tickers
// ---------------------------------------------------------------------------

const ev = (
  id: string,
  kind: EvidenceItem["kind"],
  agent: EvidenceItem["agent"],
  text: string,
  source: string,
  stars?: number | null,
  date?: string | null,
): EvidenceItem => ({ id, kind, agent, text, source, stars, date });

// ---------------------------------------------------------------------------
// Narration
// ---------------------------------------------------------------------------

export const DEMO_NARRATION = `## Reading the signals

Thirty-eight reviews, four sources, seventeen months — and one very clean break in the middle.

Everything before April 2026 averages **4.4 stars**. Everything after averages **3.1**. Nineteen reviews on each side of a single month isn't drift; it's a step, and steps have dates attached.

The reviews circle that date without naming it — *"something changed in the kitchen"*, *"The kitchen feels different."* Diners taste a change of hands but rarely know whose. Eater SF and Palo Alto Online supplied the answer: a new chef took the line in early April.

Two things arrived alongside it. **Friday** is the loud one — six reviews since 8 May, all the same shape: twenty-five to ninety minutes to food, nobody at the host stand, reserved tables waiting forty-five minutes. Reviewers keep counting the servers and refusing to blame them. It's genuinely new; a February review describes a *completely full* Friday that seated on time. And Tuesday through Thursday in the same window is still fast and hot. The weekday restaurant is fine. The Friday restaurant is not.

**Price** is the quiet one — every complaint naming a dollar figure is dated April or later. $26 is roughly market for University Ave. But a guest who waited an hour isn't pricing the plate against the market; they're pricing it against the evening.

One thing didn't change at all: the carnitas have been dry since March 2025, in sixteen reviews, straight through the chef, the prices, and Friday. That's a holding problem, not a recipe — and it's the cheapest fix on the board.

The bright spot is a person. Marisol is named in eight reviews across all seventeen months, including the two best ones written after the dip.`;

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export const DEMO_ANALYSIS: Analysis = {
  verdict:
    "Still a neighborhood favorite, but since April's kitchen change Friday service collapses — and prices went up too.",
  // No award. Casa Verde has a Michelin *Guide listing* (no star, no Bib) and a
  // warm Infatuation write-up — neither is a recognition anyone conferred, and
  // an award is never inferred. An empty array is the honest answer here.
  badges: [],
  vitals: {
    price_tier: "$$",
    booking_difficulty: "walk-in",
    busiest: "Friday–Saturday dinner",
    best_time_to_try: "Tuesday–Thursday, early",
    // No reviewer names a booking channel, so this stays null.
    reservation_route: null,
  },
  patterns: [
    {
      title: "Friday dinner service collapses",
      category: "staffing",
      trend: "new",
      frequency:
        "6 of 38 reviews — two servers covering a full floor, every one dated 2026-05-08 or later; zero before that",
      excerpts: [
        "Came in on a Friday at 7:30 and waited 25 minutes just to have someone take our drink order. Food took nearly an hour. The room was packed and clearly understaffed — I counted two servers for the whole floor.",
        "Friday night again. Ninety minutes from door to entree. The two servers on the floor were sprinting and apologizing constantly — this is a staffing problem, not a them problem.",
        "Friday dinner, 8pm. Nobody greeted us for ten minutes at the host stand. Once seated it was another twenty before a server appeared. This place used to be tight.",
        "Friday, 7pm, forty-five minute wait for a table we'd reserved. Then slow service on top of that.",
        "Second Friday in a row where service completely fell apart. Waited 40 minutes for food, then two of the four plates came out cold.",
      ],
      sources: ["yelp.com", "reddit.com", "tripadvisor.com"],
    },
    {
      title: "Carnitas tacos come out dry",
      category: "food",
      trend: "stable",
      frequency:
        "16 of 38 reviews — unchanged for seventeen months, spread evenly from 2025-03 to 2026-08 with no clustering",
      excerpts: [
        "Ordered the carnitas tacos on a recommendation and they were dry as sawdust. Tasted like they'd been sitting in a warmer.",
        "The carnitas tacos came out lukewarm and honestly kind of greasy.",
        "Skip the carnitas tacos, they were dry both times I've tried them.",
        "Carnitas tacos again disappointed — dry and a bit stringy. I keep hoping.",
        "Carnitas tacos remain the one miss on an otherwise excellent menu — dry, every single time.",
      ],
      sources: ["yelp.com", "tripadvisor.com", "opentable.com", "reddit.com"],
    },
    {
      title: "Prices up, portions down",
      category: "pricing",
      trend: "worsening",
      frequency:
        "8 of 38 reviews name a dollar figure or a percentage; all 8 are dated 2026-04-02 or later — it started in April",
      excerpts: [
        "Prices have crept up. $22 for three carnitas tacos that were, once again, dry. The al pastor is still worth it but I noticed the plate looked smaller than I remember.",
        "Food's still good but it's gotten expensive for what it is. The enchilada plate went from two to what feels like one and a half. Twenty-six dollars is a lot for that.",
        "Prices are getting hard to justify. $24 for the carnitas plate and it was dry again.",
        "prices that have quietly gone up maybe 20% in a year",
      ],
      sources: ["yelp.com", "reddit.com", "tripadvisor.com"],
    },
    {
      title: "Weekdays are fine — the failure is Friday-shaped",
      category: "consistency",
      trend: "stable",
      frequency:
        "5 of 38 reviews describe a smooth weekday visit, 4 of them inside the same window as the Friday complaints — weekday service is untouched",
      excerpts: [
        "Tuesday night, no issues at all, food was hot and fast. Whatever is happening on Fridays isn't happening the rest of the week.",
        "Went on a Tuesday and it was the Casa Verde I know — relaxed, quick, delicious. Marisol was working and everything ran like clockwork.",
        "Weekday lunch is still the best deal on University. In and out in 35 minutes.",
        "Went early on a Thursday to avoid the crowds and it was great. I'd avoid Friday based on what friends have told me.",
      ],
      sources: ["yelp.com", "tripadvisor.com"],
    },
  ],
  delta:
    "There is a hard line at April 2026. The nineteen reviews before it average 4.4 stars; the nineteen after it average 3.1 — a 1.3-star drop with no ramp. Chef Danny Reyes took over the kitchen in early April, per Eater SF and Palo Alto Online, and three reviews register the change without knowing its cause: \"something changed in the kitchen\" (23 Apr), \"The kitchen feels different\" (29 Apr), \"The kitchen feels different than it did last year too\" (18 Jul). Two other things arrived in the same window and are compounding it. Every one of the eight price complaints is dated April or later. And from 8 May onward, six reviews describe Friday dinner falling apart — a complaint that appears literally zero times in the thirteen months before it, and is contradicted by a February review of a completely full Friday that ran on time. The one thing that did NOT change is the carnitas: dry in March 2025, dry in August 2026, dry in sixteen reviews in between.",
  corroboration:
    "The reviewers' \"the kitchen feels different\" instinct is independently confirmed by the press. Gabriela Ontiveros wrote on 29 April 2026, after forty-odd visits: \"The kitchen feels different — the seasoning is off, the carnitas were dry and the al pastor came out overcooked. I don't know what happened but something did.\" Eater SF, two days earlier: \"Casa Verde has quietly handed the line to Danny Reyes, formerly of Loló, who took over the kitchen in April.\" Palo Alto Online dated the handover to the first week of April. The understaffing read is corroborated the same way — Casa Verde has run a PM server posting since 24 April, and the Mercury News reported that University Avenue operators are \"running Friday and Saturday dinner two servers short of where they were a year ago.\"",
  one_fix: {
    action:
      "Put a third server and a dedicated host on Friday dinner, starting this Friday, and hold it for six weeks.",
    why_this_one:
      "Reach: Friday 6–9pm is about 31% of a Palo Alto restaurant's weekly dinner covers, and every one of the six Friday complaints is inside your busiest three hours — this is the shift that meets the most guests. Severity: these are the only 2-star reviews Casa Verde has received all year, and they come from people who identify themselves as two-year and three-year regulars, not one-time visitors; a 1.3-star average drop maps to roughly a 5–9% revenue decline for an independent. Ease: it is one line on one schedule. No menu change, no equipment, no retraining, no negotiation with the new chef — and the posting is already live, so hiring intent exists. Compare the alternatives honestly. The carnitas complaint is more frequent (16 vs 6) but it costs you one taco, it has been survivable for seventeen months, and it is a holding-time fix you can do next week for free. The pricing complaint is real but $26 is market on University Ave; you cannot fix that with a schedule. Friday is the only one where the reviewers have already diagnosed the cause for you — they keep counting the servers and explicitly refusing to blame them — and it is the one currently converting regulars into ex-regulars.",
    evidence: [
      "The room was packed and clearly understaffed — I counted two servers for the whole floor.",
      "The two servers on the floor were sprinting and apologizing constantly — this is a staffing problem, not a them problem.",
      "We've been coming for two years and this is new.",
      "Nobody greeted us for ten minutes at the host stand.",
      "Whatever is happening on Fridays isn't happening the rest of the week.",
    ],
  },
  bright_spots: [
    {
      finding:
        "Marisol is named by eight separate reviewers across all seventeen months and is the single most-praised thing about Casa Verde — pacing, product knowledge, and remembering regulars. Two of the highest-rated post-April reviews are hers.",
      excerpts: [
        "Marisol remembered our anniversary from last year and brought out a flan with a candle in it. That's not something you can train.",
        "every time she nails the pacing — apps land, plates cleared, drinks refilled without being asked. Whoever trained her, keep them.",
        "Marisol is the reason we keep coming back. She remembers our kid's name.",
        "Marisol was working and everything ran like clockwork.",
      ],
    },
    {
      finding:
        "The al pastor is carrying the restaurant — reviewers name it as the reason they tolerate the wait, the price, and the carnitas.",
      excerpts: [
        "The al pastor is the best on University Ave, full stop.",
        "Great tacos (get the al pastor, not the carnitas).",
        "The al pastor is still one of my favorite things in Palo Alto.",
      ],
    },
  ],
  key_reviews: [
    {
      quote:
        "The al pastor is still one of my favorite things in Palo Alto. But $26 for the plate, and the carnitas tacos my partner ordered were dry and lukewarm. Went on a Friday and waited a long time. Mixed feelings.",
      stars: 3,
      date: "2026-08-04",
      source: "tripadvisor.com",
      why_chosen: "most_representative",
    },
    {
      quote:
        "Friday night again. Ninety minutes from door to entree. The two servers on the floor were sprinting and apologizing constantly — this is a staffing problem, not a them problem. Felt bad for them honestly.",
      stars: 2,
      date: "2026-07-05",
      source: "yelp.com",
      why_chosen: "most_alarming",
    },
    {
      quote:
        "Went on a Tuesday and it was the Casa Verde I know — relaxed, quick, delicious. Marisol was working and everything ran like clockwork.",
      stars: 5,
      date: "2026-05-21",
      source: "yelp.com",
      why_chosen: "most_promising",
    },
  ],
  // Same corpus, rendered for someone deciding where to eat tonight. This prose
  // is conclusion, not quotation, so it is exempt from the verbatim contract —
  // but it is not allowed to hide the Friday problem.
  diner_view: {
    should_you_go:
      "Yes, on a weekday — the al pastor is still one of the best tacos in Palo Alto, but Friday is a different restaurant right now.",
    order_this: [
      "Al pastor tacos — the one thing every source agrees on",
      "The mole — reviewers call it the sleeper hit nobody talks about",
      "Salsa flight, and the elote if it's on",
    ],
    skip_this: [
      "The carnitas tacos — dry in sixteen reviews across seventeen months, under two different chefs",
    ],
    getting_in:
      "Walk in. It's not a reservation restaurant; on a weeknight you'll be seated fast. Friday is the exception — one guest waited forty-five minutes for a table they had reserved.",
    know_before: [
      "Friday dinner has been falling apart since May 2026: 25 to 90 minutes to food, two servers on a full floor, cold plates. This is the single most-reported thing about the place right now.",
      "The kitchen changed hands in April 2026. Longtime regulars say the seasoning shifted and the mole is thinner than it was.",
      "Prices are up roughly 20% in a year — budget about $26 a plate, and around $90 for two with drinks.",
    ],
    go_when: "Tuesday–Thursday, early (6–7pm), or weekday lunch",
  },
};

// ---------------------------------------------------------------------------
// Replies
// ---------------------------------------------------------------------------

export const DEMO_REPLIES: { review_excerpt: string; reply: string }[] = [
  {
    review_excerpt: "Friday, 7pm, forty-five minute wait for a table we'd reserved.",
    reply:
      "A reserved table that waits forty-five minutes isn't a reservation, and I'm sorry. We've been running Friday dinner on two servers and no host since the spring, which is on me, not on them. Starting this Friday there's a third server on the floor and someone permanently on the door. Come back on a Friday and hold me to it — ask for Marisol and tell her I sent you.",
  },
  {
    review_excerpt: "Second Friday in a row where service completely fell apart.",
    reply:
      "Two Fridays in a row is a pattern, not bad luck, and you shouldn't have had to write it twice. Third server goes on the Friday schedule this week. Separately: you're right about the carnitas, and you're the sixteenth person to say it. That dryness is a holding problem on our end, not the recipe — we're pulling them off the warmer and firing them to order starting Monday.",
  },
  {
    review_excerpt: "The kitchen feels different — the seasoning is off",
    reply:
      "Forty visits earns you a straight answer: yes, it is different. We changed hands in the kitchen in April and we clearly let some things drift while we found our footing — the seasoning and the al pastor timing are the two we've heard most and both are being re-specced this week. Thank you for telling us instead of just not coming back. I'd like to cook for you again once it's right.",
  },
  {
    review_excerpt: "Prices have crept up. $22 for three carnitas tacos",
    reply:
      "The price went up and the plate didn't get better, which is the part I can't defend. The tacos are the specific problem — they've been coming off a warmer and drying out, and we're changing that this week. If the al pastor is what keeps you coming, order it and tell your server I said the third one's on us next visit.",
  },
];

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export const DEMO_EVENTS: { at: number; event: SwarmEvent }[] = [
  { at: 0, event: { type: "swarm/start", restaurant: DEMO_RESTAURANT, city: DEMO_CITY } },

  // ---- spawn wave: near-simultaneous, staggered 150–700ms ----
  { at: 150, event: { type: "agent/status", id: "reviews", status: "spawned", line: "spawned · target: 4 review sources", t: 150 } },
  { at: 280, event: { type: "agent/status", id: "press", status: "spawned", line: "spawned · target: food press", t: 280 } },
  { at: 390, event: { type: "agent/status", id: "pulse", status: "spawned", line: "spawned · target: local news + filings", t: 390 } },
  { at: 500, event: { type: "agent/status", id: "social", status: "spawned", line: "spawned · target: tiktok + instagram", t: 500 } },
  { at: 600, event: { type: "agent/status", id: "inspector", status: "spawned", line: "spawned · target: county health portal", t: 600 } },
  { at: 650, event: { type: "agent/status", id: "menu", status: "spawned", line: "spawned · target: current menu + prices", t: 650 } },
  { at: 700, event: { type: "agent/status", id: "context", status: "spawned", line: "spawned · target: market benchmarks", t: 700 } },

  // ---- searching ----
  { at: 900, event: { type: "agent/status", id: "reviews", status: "searching", line: "searching yelp.com…", t: 900 } },
  { at: 1000, event: { type: "agent/domain", id: "reviews", domain: "yelp.com" } },
  { at: 1100, event: { type: "agent/status", id: "press", status: "searching", line: "searching eater.com, theinfatuation.com…", t: 1100 } },
  { at: 1250, event: { type: "agent/domain", id: "press", domain: "eater.com" } },
  { at: 1400, event: { type: "agent/status", id: "pulse", status: "searching", line: "searching local news for \"Casa Verde\" Palo Alto…", t: 1400 } },
  { at: 1550, event: { type: "agent/status", id: "social", status: "searching", line: "searching tiktok.com, instagram.com…", t: 1550 } },
  { at: 1700, event: { type: "agent/domain", id: "social", domain: "tiktok.com" } },
  { at: 1800, event: { type: "agent/status", id: "menu", status: "searching", line: "searching for a current Casa Verde menu…", t: 1800 } },
  { at: 1900, event: { type: "agent/status", id: "inspector", status: "searching", line: "querying Santa Clara County inspection portal…", t: 1900 } },
  { at: 2000, event: { type: "agent/status", id: "context", status: "searching", line: "searching Peninsula restaurant labor + pricing data…", t: 2000 } },
  { at: 2050, event: { type: "agent/domain", id: "menu", domain: "order.toasttab.com" } },
  { at: 2100, event: { type: "agent/domain", id: "reviews", domain: "opentable.com" } },

  // ---- reading ----
  { at: 2300, event: { type: "agent/status", id: "reviews", status: "reading", line: "reading 5 pages…", t: 2300 } },
  { at: 2500, event: { type: "agent/domain", id: "press", domain: "theinfatuation.com" } },
  { at: 2700, event: { type: "agent/status", id: "press", status: "reading", line: "reading 3 articles…", t: 2700 } },

  {
    at: 2900,
    event: {
      type: "agent/evidence",
      id: "reviews",
      items: [
        ev("r-1", "review", "reviews", "Been coming here since they opened. The al pastor is the best on University Ave, full stop.", "yelp.com", 5, "2025-03-08"),
        ev("r-2", "review", "reviews", "Carnitas tacos were a little dry but the al pastor made up for it.", "yelp.com", 4, "2025-03-19"),
      ],
    },
  },

  { at: 3200, event: { type: "agent/domain", id: "pulse", domain: "paloaltoonline.com" } },
  { at: 3300, event: { type: "agent/status", id: "menu", status: "reading", line: "reading menu PDF + 1 delivery listing…", t: 3300 } },
  { at: 3400, event: { type: "agent/status", id: "social", status: "reading", line: "reading 12 posts…", t: 3400 } },
  { at: 3600, event: { type: "agent/domain", id: "social", domain: "instagram.com" } },

  {
    at: 3800,
    event: {
      type: "agent/evidence",
      id: "reviews",
      items: [
        ev("r-3", "review", "reviews", "The carnitas tacos came out lukewarm and honestly kind of greasy.", "yelp.com", 3, "2025-04-09"),
        ev("r-4", "review", "reviews", "Marisol took care of us and she is a total pro.", "tripadvisor.com", 5, "2025-04-22"),
      ],
    },
  },

  { at: 4100, event: { type: "agent/status", id: "pulse", status: "reading", line: "reading paloaltoonline.com…", t: 4100 } },
  { at: 4200, event: { type: "agent/domain", id: "menu", domain: "doordash.com" } },
  { at: 4400, event: { type: "agent/domain", id: "press", domain: "guide.michelin.com" } },
  { at: 4600, event: { type: "agent/status", id: "press", status: "extracting", line: "extracting quotes from 3 articles…", t: 4600 } },

  {
    at: 4900,
    event: {
      type: "agent/evidence",
      id: "press",
      items: [
        ev("p-1", "finding", "press", "Casa Verde has quietly handed the line to Danny Reyes, formerly of Loló, who took over the kitchen in April.", "eater.com", null, "2026-04-27"),
        ev("p-2", "finding", "press", "Still the most reliable weeknight Mexican on University Ave, and the al pastor is the reason.", "theinfatuation.com", null, "2025-11-12"),
      ],
    },
  },

  { at: 5000, event: { type: "agent/status", id: "context", status: "reading", line: "reading 4 sources…", t: 5000 } },
  { at: 5200, event: { type: "agent/domain", id: "reviews", domain: "reddit.com" } },
  { at: 5300, event: { type: "agent/status", id: "menu", status: "extracting", line: "extracting 46 item prices…", t: 5300 } },
  { at: 5400, event: { type: "agent/status", id: "reviews", status: "extracting", line: "extracting reviews…", t: 5400 } },

  {
    at: 5700,
    event: {
      type: "agent/evidence",
      id: "reviews",
      items: [
        ev("r-5", "review", "reviews", "Ordered the carnitas tacos on a recommendation and they were dry as sawdust. Tasted like they'd been sitting in a warmer.", "yelp.com", 2, "2025-06-11"),
        ev("r-6", "review", "reviews", "My go-to for a weeknight dinner. Never had a bad meal.", "yelp.com", 5, "2025-07-02"),
        ev("r-7", "review", "reviews", "every time she nails the pacing — apps land, plates cleared, drinks refilled without being asked. Whoever trained her, keep them.", "opentable.com", 5, "2025-08-05"),
      ],
    },
  },

  { at: 5950, event: { type: "agent/status", id: "press", status: "done", line: "✓ 3 findings from 3 outlets", t: 5950 } },
  { at: 6000, event: { type: "agent/done", id: "press", count: 3, t: 6000 } },

  {
    at: 6100,
    event: {
      type: "agent/evidence",
      id: "menu",
      items: [
        ev("m-1", "finding", "menu", "Carnitas plate now listed at $24.00 — the archived September 2025 menu had it at $19.00 (+26%).", "order.toasttab.com", null, "2026-08-06"),
        ev("m-2", "finding", "menu", "Enchilada plate $26.00, three-taco plates $22.00 — both raised once since April 2026.", "doordash.com", null, "2026-08-06"),
      ],
    },
  },
  { at: 6300, event: { type: "agent/status", id: "social", status: "extracting", line: "extracting mentions…", t: 6300 } },

  {
    at: 6600,
    event: {
      type: "agent/evidence",
      id: "social",
      items: [
        ev("s-1", "social", "social", "palo alto has no business having al pastor this good", "tiktok.com", null, null),
        ev("s-2", "social", "social", "go on a weekday tho, friday is a war zone rn", "tiktok.com", null, null),
      ],
    },
  },

  { at: 6700, event: { type: "agent/status", id: "menu", status: "done", line: "✓ 46 items priced · 4 increases since April", t: 6700 } },
  { at: 6900, event: { type: "agent/done", id: "menu", count: 46, t: 6900 } },
  { at: 6950, event: { type: "agent/domain", id: "pulse", domain: "mercurynews.com" } },
  { at: 7200, event: { type: "agent/status", id: "inspector", status: "reading", line: "no response from portal — retrying (2/3)…", t: 7200 } },

  {
    at: 7500,
    event: {
      type: "agent/evidence",
      id: "reviews",
      items: [
        ev("r-8", "review", "reviews", "Skip the carnitas tacos, they were dry both times I've tried them.", "tripadvisor.com", 4, "2025-08-23"),
        ev("r-9", "review", "reviews", "This is a real restaurant, not a Cal Ave tourist trap. The kitchen knows what it's doing.", "yelp.com", 5, "2025-10-15"),
        ev("r-10", "review", "reviews", "Great tacos (get the al pastor, not the carnitas).", "reddit.com", 4, "2025-10-24"),
      ],
    },
  },

  { at: 7900, event: { type: "agent/status", id: "pulse", status: "extracting", line: "extracting dated events…", t: 7900 } },

  // ---- the failure ----
  { at: 8000, event: { type: "agent/failed", id: "inspector", error: "No public inspection portal responded.", t: 8000 } },

  { at: 8400, event: { type: "agent/domain", id: "reviews", domain: "tripadvisor.com" } },
  {
    at: 8500,
    event: {
      type: "agent/evidence",
      id: "social",
      items: [
        ev("s-3", "social", "social", "waited 50 min last friday and we had a reservation 😭", "instagram.com", null, null),
        ev("s-4", "social", "social", "is it just me or did the mole change", "instagram.com", null, null),
      ],
    },
  },
  { at: 8700, event: { type: "agent/status", id: "social", status: "done", line: "✓ 6 mentions across 2 platforms", t: 8700 } },
  { at: 9000, event: { type: "agent/done", id: "social", count: 6, t: 9000 } },
  { at: 9050, event: { type: "social/collected", pulse: SOCIAL_PULSE } },

  {
    at: 9400,
    event: {
      type: "agent/evidence",
      id: "pulse",
      items: [
        ev("pu-1", "finding", "pulse", "Chef Danny Reyes started at Casa Verde in early April, taking over from founding chef-owner Elena Cortez, who has stepped back to run the business side.", "paloaltoonline.com", null, "2026-04-11"),
        ev("pu-2", "finding", "pulse", "Now hiring: PM servers, Thu–Sun. Immediate start.", "paloaltoonline.com", null, "2026-04-24"),
      ],
    },
  },

  { at: 9600, event: { type: "agent/status", id: "context", status: "extracting", line: "extracting comparable stats…", t: 9600 } },
  { at: 9800, event: { type: "agent/status", id: "reviews", status: "reading", line: "reading tripadvisor.com…", t: 9800 } },

  {
    at: 10200,
    event: {
      type: "agent/evidence",
      id: "reviews",
      items: [
        ev("r-11", "review", "reviews", "Friday night and the room was completely full, but we were seated on time and had drinks in five minutes.", "opentable.com", 5, "2026-02-18"),
        ev("r-12", "review", "reviews", "Prices have crept up. $22 for three carnitas tacos that were, once again, dry.", "yelp.com", 3, "2026-04-02"),
        ev("r-13", "review", "reviews", "Nice dinner but something changed in the kitchen.", "tripadvisor.com", 3, "2026-04-23"),
      ],
    },
  },

  { at: 10400, event: { type: "agent/status", id: "context", status: "done", line: "✓ 4 benchmarks from 4 sources", t: 10400 } },
  { at: 10500, event: { type: "agent/done", id: "context", count: 4, t: 10500 } },
  { at: 10600, event: { type: "context/collected", stats: CONTEXT_STATS } },

  { at: 10700, event: { type: "agent/status", id: "pulse", status: "reading", line: "cross-checking eater.com against paloaltoonline.com…", t: 10700 } },

  {
    at: 11300,
    event: {
      type: "agent/evidence",
      id: "pulse",
      items: [
        ev("pu-3", "finding", "pulse", "Operators on University Avenue say they are running Friday and Saturday dinner two servers short of where they were a year ago.", "mercurynews.com", null, "2026-06-30"),
      ],
    },
  },

  { at: 11800, event: { type: "agent/status", id: "pulse", status: "done", line: "✓ 4 dated events · chef change confirmed 2026-04", t: 11800 } },
  { at: 12000, event: { type: "agent/done", id: "pulse", count: 4, t: 12000 } },
  { at: 12100, event: { type: "findings/collected", agent: "press", findings: PRESS_FINDINGS } },
  { at: 12250, event: { type: "findings/collected", agent: "pulse", findings: PULSE_FINDINGS } },

  {
    at: 12600,
    event: {
      type: "agent/evidence",
      id: "reviews",
      items: [
        ev("r-14", "review", "reviews", "The kitchen feels different — the seasoning is off, the carnitas were dry and the al pastor came out overcooked.", "yelp.com", 2, "2026-04-29"),
        ev("r-15", "review", "reviews", "The room was packed and clearly understaffed — I counted two servers for the whole floor.", "yelp.com", 2, "2026-05-08"),
        ev("r-16", "review", "reviews", "We've been coming for two years and this is new.", "reddit.com", 3, "2026-05-15"),
      ],
    },
  },

  { at: 13200, event: { type: "agent/status", id: "reviews", status: "extracting", line: "normalising dates and star formats…", t: 13200 } },

  {
    at: 13900,
    event: {
      type: "agent/evidence",
      id: "reviews",
      items: [
        ev("r-17", "review", "reviews", "Went on a Tuesday and it was the Casa Verde I know — relaxed, quick, delicious.", "yelp.com", 5, "2026-05-21"),
        ev("r-18", "review", "reviews", "Second Friday in a row where service completely fell apart.", "yelp.com", 2, "2026-05-29"),
        ev("r-19", "review", "reviews", "Nobody greeted us for ten minutes at the host stand.", "yelp.com", 2, "2026-06-12"),
      ],
    },
  },

  {
    at: 15200,
    event: {
      type: "agent/evidence",
      id: "reviews",
      items: [
        ev("r-20", "review", "reviews", "Prices are getting hard to justify. $24 for the carnitas plate and it was dry again.", "reddit.com", 3, "2026-07-02"),
        ev("r-21", "review", "reviews", "The two servers on the floor were sprinting and apologizing constantly — this is a staffing problem, not a them problem.", "yelp.com", 2, "2026-07-05"),
        ev("r-22", "review", "reviews", "Carnitas tacos remain the one miss on an otherwise excellent menu — dry, every single time.", "opentable.com", 3, "2026-07-08"),
      ],
    },
  },

  { at: 16000, event: { type: "agent/status", id: "reviews", status: "extracting", line: "deduping across 4 sources…", t: 16000 } },

  {
    at: 16400,
    event: {
      type: "agent/evidence",
      id: "reviews",
      items: [
        ev("r-23", "review", "reviews", "prices that have quietly gone up maybe 20% in a year", "tripadvisor.com", 3, "2026-07-18"),
        ev("r-24", "review", "reviews", "Whatever is happening on Fridays isn't happening the rest of the week.", "yelp.com", 4, "2026-07-25"),
        ev("r-25", "review", "reviews", "Friday, 7pm, forty-five minute wait for a table we'd reserved.", "yelp.com", 2, "2026-07-31"),
      ],
    },
  },

  { at: 16800, event: { type: "agent/status", id: "reviews", status: "done", line: "✓ 38 reviews from 4 sources", t: 16800 } },
  { at: 17000, event: { type: "agent/done", id: "reviews", count: 38, t: 17000 } },
  { at: 17200, event: { type: "reviews/collected", reviews: DEMO_REVIEWS } },

  // Last event. The host app takes over here: it types DEMO_NARRATION out as
  // synthesis/token chunks, then dispatches synthesis/done with DEMO_ANALYSIS.
  { at: 18000, event: { type: "synthesis/start" } },
];
