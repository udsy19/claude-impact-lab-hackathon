/**
 * Candidate discovery.
 *
 * Priority order is deliberate and is the cache-first law in practice:
 *   1. our own `restaurants` table (pre-indexed, may already carry a dossier)
 *   2. Overpass (OSM) — free, exhaustive, but only gives name/coords/tags
 *   3. one Tavily search — seeds names the map doesn't know are worth eating at
 *
 * 2 and 3 only run when the table is thin for this area.
 */
import { db } from "../db";
import { haversineMiles, slugify } from "../lib/geo";
import { search } from "../api/tavily";
import { completeJSON } from "../api/claude";
import type { Restaurant, Vibe } from "../db/types";
import type { Candidate, Constraints, Place } from "./types";
import { radiusFor } from "./types";

const MIN_CANDIDATES = 8;
const OVERPASS = "https://overpass-api.de/api/interpreter";

/** OSM amenity/cuisine → our four vibes. */
const AMENITY_VIBE: Record<string, Vibe[]> = {
  restaurant: ["meal", "munch"],
  cafe: ["snack", "drink"],
  bar: ["drink"],
  pub: ["drink", "munch"],
  fast_food: ["munch", "snack"],
  ice_cream: ["snack"],
  bakery: ["snack"],
};

interface OsmElement {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function osmPrice(tags: Record<string, string>): number | null {
  // OSM rarely carries price; treat absence as unknown rather than cheap.
  const p = tags["price_range"] ?? tags["price"];
  if (!p) return null;
  const dollars = (p.match(/\$/g) ?? []).length;
  return dollars >= 1 && dollars <= 4 ? dollars : null;
}

async function fromOverpass(
  place: Place,
  radiusMiles: number,
  signal?: AbortSignal,
): Promise<Omit<Restaurant, "id">[]> {
  const meters = Math.round(radiusMiles * 1609.34);
  const q = `
[out:json][timeout:20];
(
  node["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream)$"](around:${meters},${place.lat},${place.lng});
  way["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream)$"](around:${meters},${place.lat},${place.lng});
);
out center 120;`.trim();

  try {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(q)}`,
      signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { elements?: OsmElement[] };
    const out: Omit<Restaurant, "id">[] = [];
    for (const el of data.elements ?? []) {
      const tags = el.tags ?? {};
      const name = tags.name?.trim();
      if (!name) continue; // an unnamed node is useless to a diner
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (typeof lat !== "number" || typeof lng !== "number") continue;
      const cuisine = (tags.cuisine ?? "")
        .split(/[;,]/)
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);
      out.push({
        name,
        slug: slugify(name, place.city),
        city: place.city,
        neighborhood: place.neighborhood,
        lat,
        lng,
        cuisine_tags: cuisine,
        vibe_tags: AMENITY_VIBE[tags.amenity ?? ""] ?? ["meal"],
        price_tier: osmPrice(tags),
        osm_id: String(el.id),
        website: tags.website ?? null,
      });
    }
    return out;
  } catch {
    return []; // Overpass is a backup source; its failure is not fatal
  }
}

const VIBE_WORD: Record<Vibe, string> = {
  drink: "bars and cocktail spots",
  snack: "bakeries and coffee",
  munch: "casual cheap eats",
  meal: "restaurants for dinner",
};

/**
 * Tavily seeds names that OSM has but can't rank, or doesn't have at all.
 *
 * A regex over result titles was tried first and produced garbage — listicle
 * titles ("The 15 Best Cheap Eats in San Francisco") yielded "Best Cheap Eats
 * San" and "Francisco" as restaurant names. Extracting entities from prose is
 * exactly the job of the model, so one cheap call does it instead.
 */
async function fromTavily(
  place: Place,
  c: Constraints,
  signal?: AbortSignal,
): Promise<string[]> {
  const what = c.extraTags?.length
    ? c.extraTags.join(" ")
    : VIBE_WORD[c.vibes[0] ?? "meal"];
  const where = [place.neighborhood, place.city].filter(Boolean).join(" ");
  try {
    const results = await search(`best ${what} in ${where}`, {
      maxResults: 6,
      raw: false,
      signal,
    });
    if (!results.length) return [];

    const corpus = results
      .map((r) => `${r.title}\n${(r.content ?? "").slice(0, 900)}`)
      .join("\n---\n")
      .slice(0, 6000);

    const out = await completeJSON<{ names: string[] }>(
      `Below are search results about ${what} in ${where}.

<results>
${corpus}
</results>

Extract the names of ACTUAL RESTAURANTS, BARS OR CAFES mentioned as places to
eat or drink in ${where}. Return ONLY JSON: {"names": ["..."]}

Rules:
- Real venue names only. Never article titles, publication names, list headings,
  neighbourhood names, or city names. "Best Cheap Eats in SF" is not a
  restaurant; "El Farolito" is.
- The name as the venue writes it, without descriptions or addresses.
- Maximum 12. If the results name no real venues, return {"names": []}.`,
      600,
      signal,
    );

    const banned = new Set(
      [place.city, place.neighborhood, "san francisco", "new york"]
        .filter(Boolean)
        .map((s) => (s as string).toLowerCase()),
    );
    return (out?.names ?? [])
      .map((n) => n.trim())
      .filter(
        (n) =>
          n.length > 2 &&
          n.length < 60 &&
          !banned.has(n.toLowerCase()) &&
          !/^(the\s+)?(best|top|where|guide|\d+)\b/i.test(n),
      )
      .slice(0, 12);
  } catch {
    return [];
  }
}

export async function findCandidates(
  place: Place,
  c: Constraints,
  signal?: AbortSignal,
): Promise<Candidate[]> {
  const radius = radiusFor(c.distance);

  let rows = await db.nearbyRestaurants({
    lat: place.lat,
    lng: place.lng,
    radiusMiles: radius,
    vibes: c.vibes.length ? c.vibes : undefined,
    priceTiers: c.budgets.length ? c.budgets : undefined,
    limit: 60,
  });

  // Exhaust the cache before ever touching the network — that is the whole
  // cost model. Relaxing price (a soft preference the ranker can still weigh)
  // and then radius costs two local queries; going to Overpass costs seconds.
  if (rows.length < MIN_CANDIDATES && c.budgets.length) {
    const seen = new Set(rows.map((r) => r.id));
    const relaxed = await db.nearbyRestaurants({
      lat: place.lat,
      lng: place.lng,
      radiusMiles: radius,
      vibes: c.vibes.length ? c.vibes : undefined,
      limit: 60,
    });
    rows = [...rows, ...relaxed.filter((r) => !seen.has(r.id))];
  }

  if (rows.length < MIN_CANDIDATES) {
    const seen = new Set(rows.map((r) => r.id));
    const wider = await db.nearbyRestaurants({
      lat: place.lat,
      lng: place.lng,
      radiusMiles: Math.max(radius * 2, 1.5),
      vibes: c.vibes.length ? c.vibes : undefined,
      limit: 60,
    });
    rows = [...rows, ...wider.filter((r) => !seen.has(r.id))];
  }

  // Genuinely thin area: widen with free map data, then persist so the next
  // user in this neighbourhood gets an instant answer.
  if (rows.length < MIN_CANDIDATES) {
    const [osm] = await Promise.all([fromOverpass(place, radius, signal)]);
    const wanted = c.vibes.length
      ? osm.filter((r) => r.vibe_tags.some((v) => c.vibes.includes(v)))
      : osm;
    if (wanted.length) {
      const saved = await db.upsertRestaurants(wanted.slice(0, 60));
      const seen = new Set(rows.map((r) => r.id));
      rows = [...rows, ...saved.filter((r) => !seen.has(r.id))];
    }
  }

  // Still thin, or the user asked for something specific: ask the web.
  if (rows.length < MIN_CANDIDATES || c.extraTags?.length) {
    const names = await fromTavily(place, c, signal);
    if (names.length) {
      const stubs = names.map((n) => ({
        name: n,
        slug: slugify(n, place.city),
        city: place.city,
        neighborhood: place.neighborhood,
        lat: place.lat, // approximate: refined when a dossier is built
        lng: place.lng,
        cuisine_tags: c.extraTags ?? [],
        vibe_tags: c.vibes.length ? c.vibes : (["meal"] as Vibe[]),
        price_tier: null,
      }));
      const saved = await db.upsertRestaurants(stubs);
      const seen = new Set(rows.map((r) => r.id));
      rows = [...rows, ...saved.filter((r) => !seen.has(r.id))];
    }
  }

  const dossiers = await db.dossiersFor(rows.map((r) => r.id));

  return rows
    .map((r) => {
      const d = dossiers[r.id];
      const health = d?.health;
      const dv = d?.diner_view as { order_this?: string[] } | null | undefined;
      return {
        restaurant: r,
        miles:
          r.lat != null && r.lng != null
            ? haversineMiles(place, { lat: r.lat, lng: r.lng })
            : radius,
        hasDossier: !!d && d.status !== "failed" && !!d.verdict,
        verdict: d?.verdict ?? null,
        badges: (d?.badges as { label: string }[] | undefined) ?? [],
        healthGrade:
          health && health.status === "matched" ? health.grade : null,
        healthScore:
          health && health.status === "matched" ? health.score : null,
        healthCritical:
          health?.status === "matched" && health.critical_violations.length > 0,
        topDish: dv?.order_this?.[0] ?? null,
      } satisfies Candidate;
    })
    .sort((a, b) => a.miles - b.miles)
    .slice(0, 40);
}
