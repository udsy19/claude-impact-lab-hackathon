// Every prompt the swarm uses. Kept in one file so they're easy to iterate on.

const NO_FENCE = "Respond with ONLY the JSON. No markdown fences, no preamble.";

/** Prompt 1 — PARSE (paste drawer). Messy pasted text -> reviews. */
export const PARSE_PROMPT = (rawText: string, todayISO: string) => `
You are a parser. The text below was pasted by a restaurant owner straight out of
Google Maps, Yelp, or a spreadsheet. It is messy: reviewer names, star glyphs,
relative dates, "Useful / Funny / Cool" counts, owner responses, blank lines.

Extract every individual customer review into a JSON array of:
{"date": string|null, "stars": number|null, "text": string, "source": "pasted"}

Rules:
- "date" is ISO (YYYY-MM-DD) or null. Today is ${todayISO}; convert relative
  dates against it. Month+year only -> the 15th of that month.
- "stars" is 1-5 or null. Convert "★★★★☆", "4.0 star rating", "4/5" alike.
- "text" is the reviewer's own prose ONLY — strip names, star glyphs, date
  lines, "Useful 3 Funny 0", "Local Guide · 42 reviews", and any "Response from
  the owner" block (that is the restaurant talking, not a customer).
- Verbatim. Do not paraphrase, correct spelling, or summarize — these strings
  are quoted as evidence later.
- Drop near-duplicate passages (near-identical text = the same review twice).
- Skip entries that are empty after stripping.

${NO_FENCE}

<pasted_reviews>
${rawText}
</pasted_reviews>
`.trim();

/**
 * REVIEWS agent extraction. Input is raw page dumps from Yelp menu-item pages,
 * which interleave genuine customer prose with menu copy and site chrome.
 */
export const REVIEW_EXTRACT_PROMPT = (
  name: string,
  city: string,
  blocks: string,
  todayISO: string,
) => `
Below are raw text passages scraped from public restaurant pages for
"${name}" in ${city}. They are a mix of: genuine customer reviews, menu item
descriptions, site navigation, cookie notices, and SEO boilerplate.

Extract ONLY genuine customer-voice review passages into a JSON array of:
{"date": string|null, "stars": number|null, "text": string, "source": "<domain>"}

How to tell them apart:
- A REVIEW has a narrator — "I", "we", "my wife", "our server" — and describes
  an experience: what they ate, how it was, how long it took, what it cost.
- MENU COPY is third-person product description: "Vegan. Gluten-free. Fresh rice
  paper rolls filled with grilled tofu... served with peanut sauce." Discard it.
- CHROME is cookie notices, "This is the version of our website...", nav lists,
  "Write a review", photo counts. Discard it.
- OWNER RESPONSES are the business replying. Discard them.

Rules:
- "text" verbatim, trimmed to the reviewer's own sentences. Never paraphrase.
- "source" is the domain the passage came from (given per block below).
- "date" ISO or null; today is ${todayISO}, convert relative dates ("8 years
  ago") against it. If a passage has no date signal, use null — do not guess.
- "stars" only if explicitly stated; otherwise null. A passage saying "(9/10)"
  about a dish is NOT a star rating for the restaurant — use null.
- Drop near-duplicates: if two passages share their first ~15 words, keep one.
- If a passage is a mix of review and menu copy, keep only the review sentences.
- Return [] if nothing qualifies. Do not invent reviews.

${NO_FENCE}

<passages>
${blocks}
</passages>
`.trim();

/** PRESS and PULSE share a shape; the lens differs. */
export const FINDINGS_EXTRACT_PROMPT = (
  name: string,
  city: string,
  lens: string,
  blocks: string,
  todayISO: string,
) => `
Below are raw text passages from public web pages about "${name}" in ${city}.

${lens}

Extract into a JSON array of:
{"finding": string, "quote": string|null, "source": "<domain>", "date": string|null}

Rules:
- "finding" is one specific sentence in your own words — what this tells an
  operator. No vagueness: name dishes, people, dates, numbers where present.
- "quote" is a VERBATIM span from the passage supporting it, or null if the
  passage only supports a paraphrase. Never fabricate a quote.
- Only include passages genuinely about THIS restaurant. A city roundup that
  merely lists the name in passing is not a finding — discard it.
- "date" ISO or null. Today is ${todayISO}.
- Return [] if nothing qualifies. An empty result is a valid, honest answer.

${NO_FENCE}

<passages>
${blocks}
</passages>
`.trim();

export const PRESS_LENS = `
Your lens: professional criticism and editorial coverage. Extract critic
verdicts, dishes specifically praised or panned by name, service observations,
awards or guide listings (Michelin, James Beard), and any stated prices.`.trim();

export const PULSE_LENS = `
Your lens: discontinuities. Extract ownership changes, chef hires or departures,
openings, closures, renovations, expansions, relocations, lawsuits, or anything
dated that could explain a shift in customer experience over time. A dated event
is far more valuable than an undated one — prioritize anything with a date.`.trim();

/** SOCIAL agent — captions and snippets only; video content is not extractable. */
export const SOCIAL_EXTRACT_PROMPT = (
  name: string,
  city: string,
  blocks: string,
) => `
Below are search snippets and page text from social platforms and articles
about social buzz, for "${name}" in ${city}.

Extract genuine social mentions of THIS restaurant into:
{"platform": string, "gist": string, "quote": string|null, "dish_or_topic": string|null, "url": string|null}

Then judge the overall buzz and return ONE object:
{"buzz_level": "quiet"|"steady"|"buzzing"|"viral", "driving_it": string, "mentions": [...]}

Rules:
- Discard generic city food roundups unless this restaurant is specifically
  discussed at length.
- CRITICAL — never fabricate buzz. Most restaurants have almost no social
  footprint. If the snippets are junk, thin, or not actually about this place,
  return {"buzz_level": "quiet", "driving_it": "No significant social footprint
  found.", "mentions": []}. That is a correct and valuable answer.
- "viral" requires clear evidence of an unusual spike — an article about the
  virality, or many recent posts about one dish. Do not use it loosely.
- "driving_it" names the specific dish, moment, or person driving mentions.

${NO_FENCE}

<passages>
${blocks}
</passages>
`.trim();

/** CONTEXT agent — 2-3 industry stats with attribution. */
export const CONTEXT_EXTRACT_PROMPT = (blocks: string) => `
From the passages below, extract 2-3 concrete, citable statistics about how
online reviews affect restaurant revenue, or about small-business adoption of
analytics tools.

Return a JSON array of {"stat": string, "source": string}.
- "stat" is one sentence containing a specific number.
- "source" names the study, publication, or organization.
- Only include a stat you can actually see in the passages. If none qualify,
  return []. Do not invent statistics — a fabricated number is worse than none.

${NO_FENCE}

<passages>
${blocks}
</passages>
`.trim();

/** Prompt 2 — SYNTHESIZE. Streamed. The product lives here. */
export const SYNTHESIZE_PROMPT = (input: {
  name: string;
  city: string;
  reviews: string;
  press: string;
  pulse: string;
  social: string;
  menu: string;
}) => `
You are an operations analyst for restaurants. Reviews are telemetry; press is a
second opinion; news explains discontinuities. You never discuss "reputation" —
you extract operational signal. Your reader is the owner-operator of
"${input.name}" in ${input.city}, who will act on this on Monday morning.

<customer_reviews>
${input.reviews}
</customer_reviews>

<press_findings>
${input.press}
</press_findings>

<news_and_changes>
${input.pulse}
</news_and_changes>

<social_pulse>
${input.social}
</social_pulse>

<menu_and_prices>
${input.menu}
</menu_and_prices>

Respond in TWO parts, in this order.

PART ONE — a section headed exactly:

## Reading the signals

Then 5-10 short prose lines of genuine, specific analysis narration. This is
read aloud as you write it, so make every line carry information: name dishes,
days of the week, prices, staff, dates. No filler, no "let me analyze" throat
clearing, no restating the task. Think out loud like an analyst who has just
finished reading everything.

PART TWO — a fenced json block with exactly this shape:

\`\`\`json
{
  "patterns": [
    {"title": "", "category": "service|food|pacing|pricing|staffing|ambience|consistency",
     "frequency": "", "trend": "improving|worsening|stable|new",
     "excerpts": ["at least 3 verbatim quotes"], "sources": ["yelp.com"]}
  ],
  "delta": "2-3 sentences: recent reviews vs older ones, specifics named. If a chef or ownership change was found, connect it explicitly.",
  "corroboration": "1-2 sentences on where customer reviews and professional press AGREE or CONFLICT — cite both sides.",
  "one_fix": {"action": "", "why_this_one": "", "evidence": ["verbatim excerpts"]},
  "bright_spots": [{"finding": "including staff praised by name", "excerpts": ["..."]}],
  "key_reviews": [
    {"quote": "", "stars": null, "date": null, "source": "",
     "why_chosen": "most_representative|most_alarming|most_promising"}
  ]
}
\`\`\`

Hard rules:
- Excerpts are VERBATIM substrings of the input. Never paraphrased, never
  stitched from two reviews. Trim to the relevant sentence or two.
- Every pattern needs at least 3 excerpts and a lever the owner can pull Monday
  — a station, a prep step, a schedule, a menu item, a price, a staffing level.
- Surface recurring dishes, days, times, prices, and staff BY NAME in the title.
  "Friday dinner service is slow" beats "slow service".
- 3 to 5 patterns, ranked by leverage (reach x severity x ease), not frequency.
- Cross-source corroboration beats single-source volume. "Customers and the
  Eater review both flag pacing" is the strongest claim available — prefer it,
  and set that pattern's "sources" to both domains.
- If a dish is viral on social but reviews complain about its execution or the
  wait it causes, that collision is automatically a top-3 pattern. Social demand
  colliding with operational reality is the highest-leverage finding this tool
  can produce.
- "key_reviews" is exactly 3 entries, one of each why_chosen value, quoted
  verbatim from the reviews with their real stars/date/source where known.
- If the evidence genuinely does not support 3 patterns, return fewer. Do not
  pad. Never invent a quote to satisfy a minimum.

Before responding, verify: could a different restaurant's owner mistake this
brief for their own? If yes, it is too generic — regenerate with more specificity.
`.trim();

/** Prompt 3 — REPLIES (footer). */
export const REPLIES_PROMPT = (reviewsJSON: string, name: string) => `
You are the owner of "${name}" writing public replies to recent negative reviews.

<reviews>
${reviewsJSON}
</reviews>

One reply per review. Each must:
- Name the specific thing that went wrong, in the reviewer's own terms.
- Say concretely what you are changing or checking because of it.
- Sound like a person who runs the place, not a brand. No "we strive to", no
  "your feedback is important to us", no "we apologize for any inconvenience".
- Be 2-3 sentences, warm and plain-spoken.
- Not offer a free meal unless the review describes something genuinely serious.

Return a JSON array of {"review_excerpt": "first ~8 words of the review", "reply": "..."}.

${NO_FENCE}
`.trim();
