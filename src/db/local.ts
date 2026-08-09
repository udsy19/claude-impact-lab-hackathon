/**
 * local.ts — the localStorage-backed Store.
 *
 * This is not a stub. It is the app's floor: it runs the whole product with no
 * network, no Supabase project, and no API keys — which is both the offline
 * path and the `?demo=1` path a judge or a first-time visitor lands on. So it
 * implements the same semantics as the Postgres backend, including the same
 * distance filtering (shared with it via lib/geo) and the same "unknown price
 * still shows up" rule.
 *
 * Two hostile realities it is built for:
 *
 *   1. localStorage is user-writable and survives deploys, so it *will* contain
 *      output from an older, incompatible version of this app. Every read is
 *      guarded — corrupt JSON degrades to an empty table, never a white screen.
 *   2. localStorage is a ~5MB cliff with no warning. On quota exhaustion we
 *      shed the oldest decision_logs (telemetry, replaceable) rather than fail
 *      a write of a dossier or a share card (the actual product).
 */

import { randomSlug, withinRadius } from "../lib/geo";
import type {
  DecisionLog,
  DossierRow,
  Restaurant,
  ShareCard,
  Store,
} from "./types";

const KEYS = {
  restaurants: "ts.restaurants",
  dossiers: "ts.dossiers",
  shareCards: "ts.share_cards",
  decisionLogs: "ts.decision_logs",
  ownerClaims: "ts.owner_claims",
} as const;

const DEFAULT_LIMIT = 40;

interface OwnerClaim {
  id: string;
  restaurant_id: string | null;
  email: string;
  created_at: string;
}

// ------------------------------------------------------------------- storage

/**
 * An in-memory stand-in used when localStorage is missing (SSR, a locked-down
 * Safari private window, a node test). The app stays fully functional for the
 * session; it just forgets on reload.
 */
const memory = new Map<string, string>();

function backing(): Pick<Storage, "getItem" | "setItem"> {
  try {
    const ls = globalThis.localStorage;
    // Touch it: Safari throws on access when storage is disabled.
    if (ls && typeof ls.getItem === "function") return ls;
  } catch {
    /* fall through to memory */
  }
  return {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
  };
}

/** Read a table. Anything that isn't a JSON array becomes an empty table. */
function readTable<T>(key: string): T[] {
  let raw: string | null = null;
  try {
    raw = backing().getItem(key);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    console.warn(`[db:local] ${key} was corrupt, starting it empty`);
    return [];
  }
}

function isQuotaError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const name = e.name;
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    // Some engines only surface it in the message.
    /quota/i.test(e.message)
  );
}

/**
 * Write a table, shedding telemetry to make room if the quota bites.
 * Throws only when even an empty decision log can't buy enough space — at that
 * point the caller genuinely could not save, and must be told.
 */
function writeTable(key: string, rows: unknown[]): void {
  const store = backing();
  for (let attempt = 0; ; attempt++) {
    try {
      store.setItem(key, JSON.stringify(rows));
      return;
    } catch (e) {
      if (!isQuotaError(e) || attempt >= 4) {
        console.warn(`[db:local] write to ${key} failed: ${(e as Error)?.message ?? e}`);
        throw e;
      }
      if (!shedOldestDecisionLogs()) {
        console.warn(`[db:local] write to ${key} failed: out of space, nothing left to shed`);
        throw e;
      }
    }
  }
}

/** Drop the oldest quarter of decision_logs. Returns false when there are none. */
function shedOldestDecisionLogs(): boolean {
  const logs = readTable<DecisionLog>(KEYS.decisionLogs);
  if (logs.length === 0) return false;
  const drop = Math.max(1, Math.floor(logs.length / 4));
  const kept = logs.slice(drop); // appended in chronological order, so oldest first
  try {
    backing().setItem(KEYS.decisionLogs, JSON.stringify(kept));
  } catch {
    return false;
  }
  console.warn(`[db:local] storage full — dropped ${drop} old decision log(s)`);
  return true;
}

const uuid = (): string =>
  typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : // Node/browser without randomUUID: still unique enough for a local table.
      `${Date.now().toString(16)}-${randomSlug(12)}`;

const nowIso = (): string => new Date().toISOString();

// -------------------------------------------------------------------- factory

/** A fully functional Store on top of localStorage. */
export function createLocalStore(): Store {
  const store: Store = {
    kind: "local",

    async nearbyRestaurants({ lat, lng, radiusMiles, vibes, priceTiers, limit }) {
      let rows = readTable<Restaurant>(KEYS.restaurants);

      if (vibes && vibes.length > 0) {
        const want = new Set<string>(vibes);
        rows = rows.filter((r) =>
          Array.isArray(r.vibe_tags) && r.vibe_tags.some((v) => want.has(v)),
        );
      }

      if (priceTiers && priceTiers.length > 0) {
        const tiers = new Set(priceTiers.filter((t) => Number.isInteger(t)));
        if (tiers.size > 0) {
          // Same rule as Postgres: unknown price is not "too expensive".
          rows = rows.filter((r) => r.price_tier == null || tiers.has(r.price_tier));
        }
      }

      return withinRadius(rows, { lat, lng }, radiusMiles, limit ?? DEFAULT_LIMIT);
    },

    async upsertRestaurants(incoming) {
      if (incoming.length === 0) return [];
      const rows = readTable<Restaurant>(KEYS.restaurants);
      const bySlug = new Map(rows.map((r, i) => [r.slug, i] as const));
      const result: Restaurant[] = [];

      for (const raw of incoming) {
        const existingIndex = bySlug.get(raw.slug);
        if (existingIndex != null) {
          const merged: Restaurant = { ...rows[existingIndex], ...raw, id: rows[existingIndex].id };
          rows[existingIndex] = merged;
          result.push(merged);
        } else {
          const created: Restaurant = { ...raw, id: uuid() };
          bySlug.set(created.slug, rows.length);
          rows.push(created);
          result.push(created);
        }
      }

      try {
        writeTable(KEYS.restaurants, rows);
      } catch {
        return []; // resilient path: a failed cache write is not fatal
      }
      return result;
    },

    async restaurantBySlug(slug) {
      return readTable<Restaurant>(KEYS.restaurants).find((r) => r.slug === slug) ?? null;
    },

    async restaurantById(id) {
      return readTable<Restaurant>(KEYS.restaurants).find((r) => r.id === id) ?? null;
    },

    async dossierFor(restaurantId) {
      return (
        readTable<DossierRow>(KEYS.dossiers).find((d) => d.restaurant_id === restaurantId) ?? null
      );
    },

    async dossiersFor(restaurantIds) {
      const want = new Set(restaurantIds.filter(Boolean));
      const out: Record<string, DossierRow> = {};
      if (want.size === 0) return out;
      for (const d of readTable<DossierRow>(KEYS.dossiers)) {
        if (want.has(d.restaurant_id)) out[d.restaurant_id] = d;
      }
      return out;
    },

    async saveDossier(patch) {
      const rows = readTable<DossierRow>(KEYS.dossiers);
      const i = rows.findIndex((d) => d.restaurant_id === patch.restaurant_id);
      const previous: DossierRow | null = i >= 0 ? rows[i] : null;

      const merged: DossierRow = {
        id: previous?.id ?? uuid(),
        restaurant_id: patch.restaurant_id,
        status: patch.status ?? previous?.status ?? "running",
        verdict: patch.verdict ?? previous?.verdict ?? null,
        badges: patch.badges ?? previous?.badges ?? [],
        vitals: patch.vitals ?? previous?.vitals ?? null,
        patterns: patch.patterns ?? previous?.patterns ?? [],
        diner_view: patch.diner_view ?? previous?.diner_view ?? null,
        key_reviews: patch.key_reviews ?? previous?.key_reviews ?? [],
        bright_spots: patch.bright_spots ?? previous?.bright_spots ?? [],
        social_pulse: patch.social_pulse ?? previous?.social_pulse ?? null,
        health: patch.health ?? previous?.health ?? null,
        evidence: patch.evidence ?? previous?.evidence ?? [],
        sources: patch.sources ?? previous?.sources ?? [],
        evidence_count: patch.evidence_count ?? previous?.evidence_count ?? 0,
        generated_at: patch.generated_at ?? previous?.generated_at ?? nowIso(),
        refresh_after: patch.refresh_after ?? previous?.refresh_after ?? null,
        health_checked_at: patch.health_checked_at ?? previous?.health_checked_at ?? null,
        view_count: patch.view_count ?? previous?.view_count ?? 0,
      };

      if (i >= 0) rows[i] = merged;
      else rows.push(merged);
      writeTable(KEYS.dossiers, rows); // throws: losing a dossier is losing the product
      return merged;
    },

    async bumpView(restaurantId) {
      const rows = readTable<DossierRow>(KEYS.dossiers);
      const i = rows.findIndex((d) => d.restaurant_id === restaurantId);
      if (i < 0) return;
      rows[i] = { ...rows[i], view_count: (rows[i].view_count ?? 0) + 1 };
      try {
        writeTable(KEYS.dossiers, rows);
      } catch {
        /* a lost view count is not worth an error */
      }
    },

    async createShareCard(dossierId, ogImage) {
      const rows = readTable<ShareCard>(KEYS.shareCards);
      const taken = new Set(rows.map((c) => c.slug));
      let slug = randomSlug(10);
      while (taken.has(slug)) slug = randomSlug(10);

      const card: ShareCard = {
        id: uuid(),
        dossier_id: dossierId,
        slug,
        og_image: ogImage ?? null,
        created_at: nowIso(),
      };
      rows.push(card);
      writeTable(KEYS.shareCards, rows); // throws: a share link that didn't save is a dead link
      return card;
    },

    async shareCardBySlug(slug) {
      const card = readTable<ShareCard>(KEYS.shareCards).find((c) => c.slug === slug);
      if (!card) return null;
      const dossier = readTable<DossierRow>(KEYS.dossiers).find((d) => d.id === card.dossier_id);
      if (!dossier) return null;
      const restaurant = readTable<Restaurant>(KEYS.restaurants).find(
        (r) => r.id === dossier.restaurant_id,
      );
      if (!restaurant) return null;
      return { ...card, dossier, restaurant };
    },

    async logDecision(row) {
      const rows = readTable<DecisionLog>(KEYS.decisionLogs);
      const created: DecisionLog = { ...row, id: uuid(), created_at: nowIso() };
      rows.push(created);
      try {
        writeTable(KEYS.decisionLogs, rows);
      } catch {
        return ""; // telemetry never breaks a session
      }
      return created.id;
    },

    async markChosen(logId, restaurantId) {
      if (!logId) return;
      const rows = readTable<DecisionLog>(KEYS.decisionLogs);
      const i = rows.findIndex((l) => l.id === logId);
      if (i < 0) return;
      rows[i] = { ...rows[i], chosen: restaurantId };
      try {
        writeTable(KEYS.decisionLogs, rows);
      } catch {
        /* already warned */
      }
    },

    async claimOwner(restaurantId, email) {
      const rows = readTable<OwnerClaim>(KEYS.ownerClaims);
      rows.push({ id: uuid(), restaurant_id: restaurantId, email, created_at: nowIso() });
      writeTable(KEYS.ownerClaims, rows); // throws: the owner must know if it didn't land
    },
  };

  return store;
}
