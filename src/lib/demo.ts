/**
 * Offline demo mode.
 *
 * `?demo=1` makes the whole decision flow work with the network off: the local
 * store is used (see db/index.ts), real captured dossiers are seeded, location
 * is fixed to the Mission, and the one call that would otherwise hit Claude —
 * ranking — is answered from the same captured data.
 *
 * The data is real: it came out of a live pre-index run, not a writing session.
 */
import { db } from "../db";
import { slugify } from "./geo";
import { DEMO_ENTRIES, DEMO_PLACE } from "../fixtures/demoData";
import type { Suggestion } from "../decision/types";
import type { Restaurant } from "../db/types";

export const isDemo =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("demo");

const FLAG = "ts.demo.seeded.v1";

/** Seeds the captured restaurants and their dossiers into the local store. */
export async function seedDemo(): Promise<void> {
  if (!isDemo) return;
  try {
    const saved = await db.upsertRestaurants(
      DEMO_ENTRIES.map((e) => ({
        ...e.restaurant,
        slug: e.restaurant.slug || slugify(e.restaurant.name, "sf"),
      })),
    );
    const bySlug = new Map(saved.map((r) => [r.slug, r]));

    for (const e of DEMO_ENTRIES) {
      const r = bySlug.get(e.restaurant.slug);
      if (!r) continue;
      await db.saveDossier({
        ...e.dossier,
        restaurant_id: r.id,
        status: "fresh",
        generated_at: new Date().toISOString(),
        // Far enough out that the demo never triggers a background refresh,
        // which would try to reach the network mid-presentation.
        refresh_after: new Date(Date.now() + 365 * 864e5).toISOString(),
        health_checked_at: new Date().toISOString(),
      });
    }
    localStorage.setItem(FLAG, "1");
    console.info(`[demo] ${DEMO_ENTRIES.length} dossiers ready offline`);
  } catch (e) {
    console.warn("[demo] seed failed", e);
  }
}

export { DEMO_PLACE };

/**
 * Stands in for the Claude ranking call. Picks from whatever candidates the
 * local store returned, preferring the ones we have dossiers for, and takes the
 * one-liner from the dossier's own diner view so the copy is still real.
 */
export function demoRank(
  cands: { restaurant: Restaurant; hasDossier: boolean; miles: number }[],
): Suggestion[] {
  const bySlug = new Map(DEMO_ENTRIES.map((e) => [e.restaurant.slug, e]));
  const ranked = [...cands].sort((a, b) => {
    const ad = bySlug.has(a.restaurant.slug) ? 0 : 1;
    const bd = bySlug.has(b.restaurant.slug) ? 0 : 1;
    if (ad !== bd) return ad - bd;
    return a.miles - b.miles;
  });

  return ranked.slice(0, 3).map((c) => {
    const entry = bySlug.get(c.restaurant.slug);
    const dv = entry?.dossier.diner_view as
      | { should_you_go?: string; order_this?: string[] }
      | undefined;
    return {
      restaurant_id: c.restaurant.id,
      one_liner_why:
        dv?.should_you_go ??
        (entry?.dossier.verdict as string | undefined) ??
        `${c.restaurant.neighborhood ?? "nearby"}, and it fits what you asked for.`,
      best_dish_if_known: dv?.order_this?.[0] ?? null,
      confidence: entry ? "high" : "low",
    };
  });
}
