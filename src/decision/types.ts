import type { Restaurant, Vibe } from "../db/types";

export const VIBES: { id: Vibe; emoji: string; label: string; hint: string }[] = [
  { id: "drink", emoji: "🍸", label: "drink", hint: "bars, wine, cocktails" },
  { id: "snack", emoji: "🍟", label: "snack", hint: "bakery, coffee, dessert" },
  { id: "munch", emoji: "🌮", label: "munch", hint: "tacos, ramen, pizza" },
  { id: "meal", emoji: "🍽️", label: "meal", hint: "proper sit-down" },
];

export const BUDGETS = [
  { tier: 1, glyph: "$", hint: "under 15" },
  { tier: 2, glyph: "$$", hint: "15–35" },
  { tier: 3, glyph: "$$$", hint: "35–75" },
  { tier: 4, glyph: "$$$$", hint: "send it" },
];

export const DISTANCES = [
  { id: "quick", emoji: "⚡", label: "quick grab", miles: 0.3, hint: "5-min walk" },
  { id: "walk", emoji: "🚶", label: "walkable", miles: 1, hint: "under a mile" },
  { id: "cycle", emoji: "🚲", label: "cycleable", miles: 3, hint: "short ride" },
  { id: "drive", emoji: "🚗", label: "driveable", miles: 10, hint: "worth the trip" },
] as const;

export type DistanceId = (typeof DISTANCES)[number]["id"];

export const HUNGERS = [
  { id: 1, label: "just vibing" },
  { id: 2, label: "peckish" },
  { id: 3, label: "hungry" },
  { id: 4, label: "HUNGRY" },
  { id: 5, label: "feral" },
] as const;

export interface Constraints {
  vibes: Vibe[]; // multi
  budgets: number[]; // multi, price tiers
  distance: DistanceId; // single
  hunger: number; // single, 1..5
  freeText?: string | null; // from "another" or the NL box
  extraTags?: string[]; // resolved from freeText
}

export interface Place {
  lat: number;
  lng: number;
  neighborhood: string | null;
  city: string | null;
  label: string;
}

/** A candidate with whatever signal we already hold for it. */
export interface Candidate {
  restaurant: Restaurant;
  miles: number;
  hasDossier: boolean;
  verdict?: string | null;
  badges?: { label: string }[];
  healthGrade?: string | null;
  healthScore?: number | null;
  healthCritical?: boolean;
  topDish?: string | null;
}

export interface Suggestion {
  restaurant_id: string;
  one_liner_why: string;
  best_dish_if_known: string | null;
  confidence: "high" | "medium" | "low";
}

export const radiusFor = (d: DistanceId): number =>
  DISTANCES.find((x) => x.id === d)?.miles ?? 1;
