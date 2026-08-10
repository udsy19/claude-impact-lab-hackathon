import { completeJSON, FAST_MODEL } from "../api/claude";
import { demoRank, isDemo } from "../lib/demo";
import { distanceLabel } from "../lib/geo";
import type { Candidate, Constraints, Suggestion } from "./types";
import { HUNGERS } from "./types";

const RANK_PROMPT = (args: {
  constraints: string;
  candidates: string;
  now: string;
  neighborhood: string;
}) => `
You are picking where someone should eat RIGHT NOW. You are decisive, you know
the neighbourhood, and you never pad. Pick exactly 3 from the candidate list.

Local time: ${args.now}
Area: ${args.neighborhood}

What they asked for:
${args.constraints}

Candidates (distance is already computed; "dossier: yes" means we have verified
evidence about this place, "dossier: no" means we know only its name and tags):
${args.candidates}

Return ONLY JSON:
[{"restaurant_id": "", "one_liner_why": "", "best_dish_if_known": null, "confidence": "high|medium|low"}]

Hard rules — these are filters, not preferences:
- TIME OF DAY. Never suggest a category that is closed or absurd right now: no
  bakery or coffee-and-pastry at 11pm, no cocktail bar at 9am, no heavy sit-down
  dinner at 7am. If the hour makes a candidate wrong, it is disqualified.
- Distance and price are already filtered; do not re-litigate them, but prefer
  closer when two candidates are otherwise equal.
- A candidate WITH a dossier outranks one without at equal fit — verified beats
  plausible.
- If a candidate has critical health violations, either leave it out or say so
  plainly in one_liner_why. Never quietly recommend it.
- Match the energy: "feral" hunger wants volume, speed and proximity, not a
  tasting menu. "just vibing" wants somewhere worth sitting in.

Writing rules:
- "one_liner_why" is ONE sentence, under 18 words, specific to THIS place. Name
  the dish, the room, the hour, or the thing that makes it right for this exact
  request. Never "great food and atmosphere" — that is a non-answer.
- Lowercase, conversational, no exclamation marks, no emoji.
- "best_dish_if_known" only when the candidate data actually names a dish.
  Otherwise null. Do not invent a signature dish.
- "confidence" is high only with a dossier AND a clean fit; low means you are
  reaching because the candidate pool was thin.
- Return the 3 best. If fewer than 3 candidates survive the hard filters, return
  fewer — a short honest list beats a padded one.
`.trim();

function describe(c: Constraints): string {
  const hunger = HUNGERS.find((h) => h.id === c.hunger)?.label ?? "hungry";
  const parts = [
    `vibe: ${c.vibes.join(", ") || "anything"}`,
    `budget: ${c.budgets.length ? c.budgets.map((b) => "$".repeat(b)).join(" or ") : "any"}`,
    `willing to travel: ${c.distance}`,
    `hunger: ${hunger}`,
  ];
  if (c.freeText) parts.push(`they also said: "${c.freeText}"`);
  return parts.map((p) => `- ${p}`).join("\n");
}

function serialise(cands: Candidate[]): string {
  return cands
    .slice(0, 30)
    .map((c) => {
      const bits = [
        `id: ${c.restaurant.id}`,
        `name: ${c.restaurant.name}`,
        `distance: ${distanceLabel(c.miles)}`,
        c.restaurant.price_tier
          ? `price: ${"$".repeat(c.restaurant.price_tier)}`
          : "price: unknown",
        `tags: ${[...c.restaurant.vibe_tags, ...c.restaurant.cuisine_tags].join("/") || "none"}`,
        `dossier: ${c.hasDossier ? "yes" : "no"}`,
      ];
      if (c.verdict) bits.push(`verdict: ${c.verdict}`);
      if (c.topDish) bits.push(`known dish: ${c.topDish}`);
      if (c.healthGrade) bits.push(`health grade: ${c.healthGrade}`);
      if (c.healthCritical) bits.push(`HAS CRITICAL HEALTH VIOLATIONS`);
      return bits.join(" | ");
    })
    .join("\n");
}

/** Deterministic fallback so a model failure never leaves the user empty. */
function fallback(cands: Candidate[]): Suggestion[] {
  return [...cands]
    .sort((a, b) => {
      if (a.hasDossier !== b.hasDossier) return a.hasDossier ? -1 : 1;
      return a.miles - b.miles;
    })
    .slice(0, 3)
    .map((c) => ({
      restaurant_id: c.restaurant.id,
      one_liner_why: c.verdict
        ? c.verdict
        : `${distanceLabel(c.miles)} away, and it fits what you asked for.`,
      best_dish_if_known: c.topDish ?? null,
      confidence: c.hasDossier ? "medium" : "low",
    }));
}

export async function rank(
  cands: Candidate[],
  c: Constraints,
  neighborhood: string,
  signal?: AbortSignal,
): Promise<Suggestion[]> {
  if (cands.length === 0) return [];
  // Offline demo: answer from captured data instead of reaching the network.
  if (isDemo) return demoRank(cands);
  const now = new Date().toLocaleString("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });

  try {
    const out = await completeJSON<Suggestion[]>(
      RANK_PROMPT({
        constraints: describe(c),
        candidates: serialise(cands),
        now,
        neighborhood,
      }),
      1500,
      signal,
      FAST_MODEL,
    );
    const valid = (Array.isArray(out) ? out : []).filter((s) =>
      cands.some((c2) => c2.restaurant.id === s.restaurant_id),
    );
    return valid.length ? valid.slice(0, 3) : fallback(cands);
  } catch {
    return fallback(cands);
  }
}

/** "another" / the free-text box → concrete cuisine tags. */
export async function resolveFreeText(
  text: string,
  signal?: AbortSignal,
): Promise<string[]> {
  try {
    const out = await completeJSON<{ tags: string[] }>(
      `The user described what they feel like eating: "${text}".
Return ONLY JSON {"tags": ["..."]} — 1 to 4 lowercase cuisine or category tags
that would match restaurants in a database (e.g. "omakase" -> ["japanese",
"sushi", "fine dining"]; "hookah" -> ["hookah lounge", "middle eastern"]).
No commentary.`,
      300,
      signal,
      FAST_MODEL,
    );
    return (out?.tags ?? []).slice(0, 4);
  } catch {
    return [text.toLowerCase()];
  }
}
