/**
 * supabase.ts — the Postgres-backed Store.
 *
 * FAILURE POLICY
 * --------------
 * A restaurant app that white-screens because a `select` timed out is worse
 * than one that shows an empty list, so reads and telemetry writes swallow
 * their errors: they `console.warn` a one-liner and return the empty value for
 * their type ([], null, {}). The three calls where silence would *lose the
 * user's work* — saveDossier, createShareCard, claimOwner — throw instead, so
 * the caller can show a real error rather than pretending it saved.
 *
 * Nothing here throws at import time. `createSupabaseStore()` returns null when
 * the env vars are absent so db/index.ts can fall back to the local store.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { boundingBox, randomSlug, withinRadius } from "../lib/geo";
import type {
  DossierRow,
  DossierStatus,
  Health,
  EvidenceRow,
  Restaurant,
  ShareCard,
  Store,
  Vibe,
} from "./types";

/** An untyped PostgREST row; every field is validated on the way out. */
type Row = Record<string, unknown>;

/**
 * Safety net for the bounding-box prefilter. We must fetch more rows than the
 * caller's `limit` because the box is a square and the answer is a circle
 * sorted by true distance, but an unbounded select over a dense city is a
 * denial of service on the phone doing the sorting.
 */
const PREFILTER_MAX_ROWS = 500;
const DEFAULT_LIMIT = 40;

// --------------------------------------------------------------- row mapping

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const nullableStr = (v: unknown): string | null =>
  typeof v === "string" ? v : null;
const nullableNum = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const DOSSIER_STATUSES: DossierStatus[] = ["fresh", "stale", "running", "failed"];
const toStatus = (v: unknown): DossierStatus =>
  DOSSIER_STATUSES.includes(v as DossierStatus) ? (v as DossierStatus) : "running";

function toRestaurant(r: Row): Restaurant {
  return {
    id: str(r.id),
    name: str(r.name),
    slug: str(r.slug),
    city: nullableStr(r.city),
    neighborhood: nullableStr(r.neighborhood),
    lat: nullableNum(r.lat),
    lng: nullableNum(r.lng),
    cuisine_tags: arr<string>(r.cuisine_tags),
    vibe_tags: arr<Vibe>(r.vibe_tags),
    price_tier: nullableNum(r.price_tier),
    osm_id: nullableStr(r.osm_id),
    website: nullableStr(r.website),
  };
}

function toDossier(d: Row): DossierRow {
  return {
    id: str(d.id),
    restaurant_id: str(d.restaurant_id),
    status: toStatus(d.status),
    verdict: nullableStr(d.verdict),
    badges: arr<unknown>(d.badges),
    vitals: d.vitals ?? null,
    patterns: arr<unknown>(d.patterns),
    diner_view: d.diner_view ?? null,
    key_reviews: arr<unknown>(d.key_reviews),
    bright_spots: arr<unknown>(d.bright_spots),
    social_pulse: d.social_pulse ?? null,
    health: (d.health as Health | null) ?? null,
    evidence: arr<EvidenceRow>(d.evidence),
    sources: arr<string>(d.sources),
    evidence_count: num(d.evidence_count),
    generated_at: nullableStr(d.generated_at),
    refresh_after: nullableStr(d.refresh_after),
    health_checked_at: nullableStr(d.health_checked_at),
    view_count: num(d.view_count),
  };
}

function toShareCard(s: Row): ShareCard {
  return {
    id: str(s.id),
    dossier_id: str(s.dossier_id),
    slug: str(s.slug),
    og_image: nullableStr(s.og_image),
    created_at: str(s.created_at),
  };
}

/** PostgREST embeds are an object for to-one, an array when it can't tell. */
function firstEmbedded(v: unknown): Row | null {
  if (Array.isArray(v)) return (v[0] as Row) ?? null;
  if (v && typeof v === "object") return v as Row;
  return null;
}

/** One-line, greppable failure note. Never includes user data. */
function warn(op: string, error: { message?: string; code?: string } | null): void {
  console.warn(`[db:supabase] ${op} failed: ${error?.code ?? ""} ${error?.message ?? "unknown error"}`.trim());
}

// ------------------------------------------------------------------- factory

function readEnv(key: string): string {
  const env = import.meta.env as Record<string, unknown> | undefined;
  const value = env?.[key];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * A Store backed by Supabase, or null when it isn't configured. Returning null
 * (rather than throwing, or building a client that 401s on every call) is what
 * lets the app boot into the local store with no Supabase project at all.
 */
export function createSupabaseStore(): Store | null {
  const url = readEnv("VITE_SUPABASE_URL");
  const anonKey = readEnv("VITE_SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;

  let client: SupabaseClient;
  try {
    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch (e) {
    console.warn(`[db:supabase] client init failed: ${(e as Error)?.message ?? e}`);
    return null;
  }

  const store: Store = {
    kind: "supabase",

    async nearbyRestaurants({ lat, lng, radiusMiles, vibes, priceTiers, limit }) {
      const box = boundingBox(lat, lng, radiusMiles);
      let q = client
        .from("restaurants")
        .select("*")
        .gte("lat", box.minLat)
        .lte("lat", box.maxLat)
        .gte("lng", box.minLng)
        .lte("lng", box.maxLng);

      if (vibes && vibes.length > 0) q = q.overlaps("vibe_tags", vibes);

      if (priceTiers && priceTiers.length > 0) {
        const tiers = priceTiers.filter((t) => Number.isInteger(t));
        if (tiers.length > 0) {
          // "$$ or $$$" must not quietly delete every place whose price we
          // simply don't know yet — unknown is not expensive.
          q = q.or(`price_tier.in.(${tiers.join(",")}),price_tier.is.null`);
        }
      }

      const { data, error } = await q.limit(PREFILTER_MAX_ROWS);
      if (error) {
        warn("nearbyRestaurants", error);
        return [];
      }

      // The box is square, the question is circular: exact haversine decides.
      return withinRadius(
        arr<Row>(data).map(toRestaurant),
        { lat, lng },
        radiusMiles,
        limit ?? DEFAULT_LIMIT,
      );
    },

    async upsertRestaurants(rows) {
      if (rows.length === 0) return [];
      const { data, error } = await client
        .from("restaurants")
        .upsert(rows, { onConflict: "slug" })
        .select();
      if (error) {
        warn("upsertRestaurants", error);
        return [];
      }
      return arr<Row>(data).map(toRestaurant);
    },

    async restaurantBySlug(slug) {
      const { data, error } = await client
        .from("restaurants")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) {
        warn("restaurantBySlug", error);
        return null;
      }
      return data ? toRestaurant(data as Row) : null;
    },

    async restaurantById(id) {
      const { data, error } = await client
        .from("restaurants")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        warn("restaurantById", error);
        return null;
      }
      return data ? toRestaurant(data as Row) : null;
    },

    async dossierFor(restaurantId) {
      const { data, error } = await client
        .from("dossiers")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      if (error) {
        warn("dossierFor", error);
        return null;
      }
      return data ? toDossier(data as Row) : null;
    },

    async dossiersFor(restaurantIds) {
      const ids = [...new Set(restaurantIds.filter(Boolean))];
      if (ids.length === 0) return {};
      // One round trip for the whole result list. Never a query per card.
      const { data, error } = await client
        .from("dossiers")
        .select("*")
        .in("restaurant_id", ids);
      if (error) {
        warn("dossiersFor", error);
        return {};
      }
      const out: Record<string, DossierRow> = {};
      for (const row of arr<Row>(data)) {
        const d = toDossier(row);
        if (d.restaurant_id) out[d.restaurant_id] = d;
      }
      return out;
    },

    async saveDossier(d) {
      const { data, error } = await client
        .from("dossiers")
        .upsert(d, { onConflict: "restaurant_id" })
        .select()
        .single();
      if (error || !data) {
        warn("saveDossier", error);
        // Throws: a dossier is minutes of model work, losing it silently would
        // leave the UI showing a spinner over nothing.
        throw new Error(`saveDossier failed: ${error?.message ?? "no row returned"}`);
      }
      return toDossier(data as Row);
    },

    async bumpView(restaurantId) {
      // Read-then-write: supabase-js has no atomic increment without an RPC,
      // and a lost concurrent bump on a view counter is a benign race.
      const { data, error } = await client
        .from("dossiers")
        .select("id, view_count")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      if (error || !data) {
        if (error) warn("bumpView:read", error);
        return;
      }
      const row = data as Row;
      const { error: upErr } = await client
        .from("dossiers")
        .update({ view_count: num(row.view_count) + 1 })
        .eq("id", str(row.id));
      if (upErr) warn("bumpView:write", upErr);
    },

    async createShareCard(dossierId, ogImage) {
      // Retry on the unique-slug race; 10 random chars make it ~never happen.
      let lastError: { message?: string; code?: string } | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await client
          .from("share_cards")
          .insert({ dossier_id: dossierId, slug: randomSlug(10), og_image: ogImage ?? null })
          .select()
          .single();
        if (!error && data) return toShareCard(data as Row);
        lastError = error;
        if (error?.code !== "23505") break; // not a slug collision: don't retry
      }
      warn("createShareCard", lastError);
      throw new Error(`createShareCard failed: ${lastError?.message ?? "no row returned"}`);
    },

    async shareCardBySlug(slug) {
      // One request: card -> dossier -> restaurant, via PostgREST embedding.
      const { data, error } = await client
        .from("share_cards")
        .select("*, dossier:dossiers(*, restaurant:restaurants(*))")
        .eq("slug", slug)
        .maybeSingle();
      if (error || !data) {
        if (error) warn("shareCardBySlug", error);
        return null;
      }

      const row = data as Row;
      const dossierRow = firstEmbedded(row.dossier);
      const restaurantRow = dossierRow ? firstEmbedded(dossierRow.restaurant) : null;
      // A card whose dossier or restaurant was deleted is not renderable.
      if (!dossierRow || !restaurantRow) return null;

      return {
        ...toShareCard(row),
        dossier: toDossier(dossierRow),
        restaurant: toRestaurant(restaurantRow),
      };
    },

    /**
     * The id is generated client-side on purpose. Returning it from the insert
     * would require `.select()`, which needs a SELECT policy on decision_logs —
     * and these rows should stay write-only to anon, like owner_claims. This
     * keeps the table unreadable while markChosen can still find its row.
     */
    async logDecision(row) {
      const id = crypto.randomUUID();
      const { error } = await client.from("decision_logs").insert({ ...row, id });
      if (error) {
        warn("logDecision", error);
        return ""; // telemetry is never worth breaking a session over
      }
      return id;
    },

    async markChosen(logId, restaurantId) {
      if (!logId) return;
      const { error } = await client
        .from("decision_logs")
        .update({ chosen: restaurantId })
        .eq("id", logId);
      if (error) warn("markChosen", error);
    },

    async claimOwner(restaurantId, email) {
      const { error } = await client
        .from("owner_claims")
        .insert({ restaurant_id: restaurantId, email });
      if (error) {
        warn("claimOwner", error);
        // Throws: an owner who typed their email deserves to know it didn't land.
        throw new Error(`claimOwner failed: ${error.message}`);
      }
    },
  };

  return store;
}
