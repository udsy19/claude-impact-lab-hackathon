/**
 * geo.ts — distance math and slug helpers. Pure, total, no React, no network.
 *
 * Two jobs live here because both are storage-layer plumbing shared by every
 * backend: turning coordinates into "how far is that, really" and turning a
 * restaurant name into a stable key we can upsert on.
 *
 * Every function is total: garbage in (NaN, null-ish, empty string) produces a
 * defined, boring result rather than a throw. The storage layer calls these on
 * data we did not author (OSM dumps, model output), so they cannot be brittle.
 */

/** Mean Earth radius in miles. */
const EARTH_RADIUS_MILES = 3958.7613;

/** Miles per degree of latitude (constant everywhere). */
const MILES_PER_DEG_LAT = (EARTH_RADIUS_MILES * Math.PI) / 180;

/** Walking pace assumption: 3 mph == 20 minutes per mile. */
const MINUTES_PER_MILE = 20;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

const clamp = (n: number, lo: number, hi: number): number =>
  n < lo ? lo : n > hi ? hi : n;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// ------------------------------------------------------------------ distance

/**
 * Great-circle distance in miles between two points. Unusable input yields
 * Infinity rather than NaN, so a broken row sorts last instead of poisoning
 * comparisons.
 */
export function haversineMiles(a: LatLng, b: LatLng): number {
  if (
    !Number.isFinite(a?.lat) ||
    !Number.isFinite(a?.lng) ||
    !Number.isFinite(b?.lat) ||
    !Number.isFinite(b?.lng)
  ) {
    return Number.POSITIVE_INFINITY; // unknown location sorts last, never "here"
  }

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * A latitude/longitude rectangle that fully contains the radius circle.
 *
 * This is a *pre-filter*, not an answer: it is deliberately slightly too big so
 * a cheap `lat between ? and ? and lng between ? and ?` in SQL never drops a
 * row that exact haversine would have kept. Callers must still filter by
 * `haversineMiles` afterwards.
 *
 * Near the poles, and when the box would cross the antimeridian, the longitude
 * span widens to the whole world rather than returning a wrapped (min > max)
 * range that a BETWEEN query would silently evaluate as empty.
 */
export function boundingBox(
  lat: number,
  lng: number,
  radiusMiles: number,
): BoundingBox {
  const safeLat = Number.isFinite(lat) ? clamp(lat, -90, 90) : 0;
  const safeLng = Number.isFinite(lng) ? clamp(lng, -180, 180) : 0;
  const r = Number.isFinite(radiusMiles) ? Math.max(0, radiusMiles) : 0;

  const dLat = r / MILES_PER_DEG_LAT;
  const cosLat = Math.cos(toRad(safeLat));
  const dLng = cosLat < 1e-6 ? 360 : r / (MILES_PER_DEG_LAT * cosLat);

  const minLng = safeLng - dLng;
  const maxLng = safeLng + dLng;
  const wraps = dLng >= 180 || minLng < -180 || maxLng > 180;

  return {
    minLat: clamp(safeLat - dLat, -90, 90),
    maxLat: clamp(safeLat + dLat, -90, 90),
    minLng: wraps ? -180 : minLng,
    maxLng: wraps ? 180 : maxLng,
  };
}

/** Minutes to walk `miles` at 20 min/mile, rounded to a whole minute. */
export function walkMinutes(miles: number): number {
  if (!Number.isFinite(miles) || miles <= 0) return 0;
  return Math.round(miles * MINUTES_PER_MILE);
}

/**
 * Human distance for a card: a walk time when it is walkable, plain miles when
 * it is not. Under a mile nobody thinks in decimals, they think in minutes.
 */
export function distanceLabel(miles: number): string {
  if (!Number.isFinite(miles) || miles < 0) return "distance unknown";
  if (miles < 1) return `${Math.max(1, walkMinutes(miles))}-min walk`;
  return `${miles.toFixed(1)} mi`;
}

/**
 * Filter rows to those inside `radiusMiles` of `origin`, nearest first.
 *
 * Shared by both storage backends so "nearby" means exactly the same thing
 * whether the rows came from Postgres or localStorage. Rows without usable
 * coordinates are dropped (haversineMiles gives them Infinity).
 */
export function withinRadius<T extends { lat: number | null; lng: number | null }>(
  rows: readonly T[],
  origin: LatLng,
  radiusMiles: number,
  limit?: number,
): T[] {
  const scored: { row: T; miles: number }[] = [];

  for (const row of rows) {
    if (row == null || row.lat == null || row.lng == null) continue;
    const miles = haversineMiles(origin, { lat: row.lat, lng: row.lng });
    if (miles <= radiusMiles) scored.push({ row, miles });
  }

  scored.sort((x, y) => x.miles - y.miles);
  const capped = limit != null && limit >= 0 ? scored.slice(0, limit) : scored;
  return capped.map((s) => s.row);
}

// ---------------------------------------------------------------------- slugs

/** Strip accents, punctuation and case; hyphenate what is left. */
function slugPart(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // combining marks left by NFD
    .replace(/[\u2019'`]/g, "") // don't turn "Joe's" into "joe-s"
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A short, stable city suffix: initials for multi-word cities ("San
 * Francisco" -> "sf"), the slugified word itself for single-word ones
 * ("Oakland" -> "oakland").
 */
function citySuffix(city: string): string {
  const cleaned = slugPart(city);
  if (!cleaned) return "";
  const words = cleaned.split("-").filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 16);
  return words
    .map((w) => w[0])
    .join("")
    .slice(0, 4);
}

/**
 * Stable slug for the `restaurants.slug` unique column, e.g.
 * `slugify("La Taquería", "San Francisco") === "la-taqueria-sf"`.
 *
 * Deliberately deterministic — no random or time component — because it is the
 * upsert conflict key: re-importing the same restaurant must land on the same
 * row instead of creating a duplicate. That means accent and punctuation
 * variants of one name ("Café Toma" / "Cafe Toma") collapse together, which is
 * the behaviour we want. The city suffix is what separates the genuinely
 * different "Tacos El Rey" in two cities; two same-named venues in one city
 * still collide by design and must be disambiguated by the caller (append a
 * neighborhood to `name`) rather than by a hash that would break stability.
 */
export function slugify(name: string, city?: string | null): string {
  const base = slugPart(typeof name === "string" ? name : "").slice(0, 80);
  const suffix = typeof city === "string" ? citySuffix(city) : "";
  const stem = base || "unnamed";
  return suffix ? `${stem}-${suffix}` : stem;
}

/** URL-safe alphabet for share slugs: lowercase alphanumerics only. */
const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * A random, url-safe share slug (default 10 chars ~= 51 bits of entropy).
 *
 * Uses crypto.getRandomValues, never Math.random: these end up in public share
 * URLs, so guessable slugs would leak other people's cards. Rejection sampling
 * keeps the alphabet uniform (256 % 36 != 0 would otherwise bias early letters).
 */
export function randomSlug(length = 10): string {
  const n = Math.max(1, Math.min(64, Math.floor(length)));
  const out: string[] = [];
  const limit = 256 - (256 % SLUG_ALPHABET.length); // 252
  const buf = new Uint8Array(n * 2);

  while (out.length < n) {
    crypto.getRandomValues(buf);
    for (const byte of buf) {
      if (byte >= limit) continue; // biased tail, resample
      out.push(SLUG_ALPHABET[byte % SLUG_ALPHABET.length]);
      if (out.length === n) break;
    }
  }

  return out.join("");
}
