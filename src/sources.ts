export const DOMAINS = {
  reviews: [
    "yelp.com",
    "google.com",
    "tripadvisor.com",
    "opentable.com",
    "resy.com",
    "reddit.com",
  ],
  press: [
    "eater.com",
    "sf.eater.com",
    "theinfatuation.com",
    "sfchronicle.com",
    "sfgate.com",
    "mercurynews.com",
    "paloaltoonline.com",
    "bonappetit.com",
  ],
  critics: ["nytimes.com", "guide.michelin.com", "theinfatuation.com"],
  awards: ["guide.michelin.com", "jamesbeard.org"],
  menus: [
    "opentable.com",
    "resy.com",
    "tock.com",
    "doordash.com",
    "ubereats.com",
    "grubhub.com",
  ],
  social: ["instagram.com", "tiktok.com", "x.com", "twitter.com"],
} as const;

/**
 * Prestige order for the Brief's provenance row. Domains not listed sort last,
 * alphabetically. Only domains that actually produced findings are ever shown.
 */
export const PRESTIGE_ORDER = [
  "guide.michelin.com",
  "jamesbeard.org",
  "nytimes.com",
  "eater.com",
  "sf.eater.com",
  "theinfatuation.com",
  "sfchronicle.com",
  "sfgate.com",
  "bonappetit.com",
  "mercurynews.com",
  "paloaltoonline.com",
  "yelp.com",
  "google.com",
  "tripadvisor.com",
  "opentable.com",
  "resy.com",
  "reddit.com",
  "tiktok.com",
  "instagram.com",
  "x.com",
];

export function byPrestige(a: string, b: string): number {
  const ia = PRESTIGE_ORDER.indexOf(a);
  const ib = PRESTIGE_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

/**
 * Query taxonomy. Validated live against Tavily on 2026-08-08:
 *   - Yelp /biz/ pages return chrome only and Tavily Extract 403s on them.
 *   - Yelp /menu/<slug>/item/<dish> pages carry full verbatim review prose and
 *     ARE cached by Tavily search with include_raw_content. That is the mine.
 *   - include_domains is a SOFT filter — off-list domains still come back,
 *     which is a feature (foodnut.com, hungryonion.org proved useful).
 */
export const QUERIES = (name: string, city: string) => ({
  locate: [`"${name}" "${city}" site:yelp.com`],
  reviews: [
    `"${name}" "${city}" yelp menu item review ordered delicious service`,
    `"${name}" "${city}" reviews service food experience`,
    `"${name}" "${city}" reviews wait staff slow busy`,
  ],
  reviewsBySlug: (slug: string) => [
    `yelp.com/menu/${slug}/item reviews photos`,
    `${slug} item reviews`,
  ],
  press: [
    `site:eater.com "${name}"`,
    `"${name}" "${city}" review critic`,
    `site:guide.michelin.com "${name}"`,
    `site:jamesbeard.org "${name}"`,
  ],
  pulse: [
    `"${name}" "${city}" news OR opening OR closing OR "new chef" OR renovation`,
    `"${name}" "${city}" owner OR founder OR chef change`,
  ],
  social: [
    `site:tiktok.com "${name}" "${city}"`,
    `site:instagram.com "${name}" "${city}"`,
    `"${name}" "${city}" tiktok viral`,
    `"${name}" "${city}" twitter OR x.com post`,
  ],
  menu: [`"${name}" "${city}" menu prices`],
  photos: [`"${name}" "${city}" restaurant photos interior dishes`],
  inspection: [`"${name}" "${city}" health inspection`],
  context: [
    `restaurant industry statistics online reviews impact revenue`,
    `small business AI adoption gap statistics`,
  ],
});

/** Captured during build so the CONTEXT agent is never load-bearing. */
export const FALLBACK_STATS = [
  {
    stat: "A one-star increase in Yelp rating drives a 5–9% increase in revenue.",
    source: "Harvard Business School, Luca (2016)",
  },
  {
    stat: "94% of diners say an online review has convinced them to avoid a restaurant.",
    source: "ReviewTrackers industry survey",
  },
];
