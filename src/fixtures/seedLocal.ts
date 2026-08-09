/**
 * Seeds the local store from seed/sf.json with real coordinates so the
 * cache-first path is exercised without Supabase. Runs once per device.
 *
 * Coordinates are real (hand-checked against the actual addresses) because the
 * whole product depends on distance being honest — a seeded restaurant at the
 * wrong corner would produce a confidently wrong "6-min walk".
 */
import { db } from "../db";
import { slugify } from "../lib/geo";
import type { Vibe } from "../db/types";

interface Seed {
  name: string;
  hood: string;
  lat: number;
  lng: number;
  vibes: Vibe[];
  tier: number;
  cuisine: string[];
}

// A representative slice of seed/sf.json with verified coords.
const SF: Seed[] = [
  { name: "La Taqueria", hood: "The Mission", lat: 37.7509, lng: -122.4183, vibes: ["munch"], tier: 1, cuisine: ["mexican", "tacos"] },
  { name: "El Farolito", hood: "The Mission", lat: 37.7529, lng: -122.4180, vibes: ["munch"], tier: 1, cuisine: ["mexican", "burritos"] },
  { name: "Taqueria Cancun", hood: "The Mission", lat: 37.7602, lng: -122.4188, vibes: ["munch"], tier: 1, cuisine: ["mexican"] },
  { name: "Tartine Bakery", hood: "The Mission", lat: 37.7614, lng: -122.4241, vibes: ["snack"], tier: 2, cuisine: ["bakery", "pastry"] },
  { name: "Bi-Rite Creamery", hood: "The Mission", lat: 37.7615, lng: -122.4256, vibes: ["snack"], tier: 1, cuisine: ["ice cream"] },
  { name: "Craftsman and Wolves", hood: "The Mission", lat: 37.7601, lng: -122.4213, vibes: ["snack"], tier: 2, cuisine: ["bakery"] },
  { name: "Flour + Water", hood: "The Mission", lat: 37.7586, lng: -122.4113, vibes: ["meal"], tier: 3, cuisine: ["italian", "pasta"] },
  { name: "Delfina", hood: "The Mission", lat: 37.7613, lng: -122.4247, vibes: ["meal"], tier: 3, cuisine: ["italian"] },
  { name: "Pizzeria Delfina", hood: "The Mission", lat: 37.7611, lng: -122.4245, vibes: ["munch"], tier: 2, cuisine: ["pizza"] },
  { name: "Foreign Cinema", hood: "The Mission", lat: 37.7566, lng: -122.4189, vibes: ["meal"], tier: 3, cuisine: ["californian"] },
  { name: "Californios", hood: "The Mission", lat: 37.7538, lng: -122.4137, vibes: ["meal"], tier: 4, cuisine: ["mexican", "tasting menu"] },
  { name: "Lazy Bear", hood: "The Mission", lat: 37.7580, lng: -122.4197, vibes: ["meal"], tier: 4, cuisine: ["american", "tasting menu"] },
  { name: "Rintaro", hood: "The Mission", lat: 37.7699, lng: -122.4137, vibes: ["meal"], tier: 3, cuisine: ["japanese", "izakaya"] },
  { name: "Trick Dog", hood: "The Mission", lat: 37.7590, lng: -122.4128, vibes: ["drink"], tier: 2, cuisine: ["cocktails"] },
  { name: "ABV", hood: "The Mission", lat: 37.7642, lng: -122.4213, vibes: ["drink", "munch"], tier: 2, cuisine: ["cocktails"] },
  { name: "True Laurel", hood: "The Mission", lat: 37.7628, lng: -122.4197, vibes: ["drink"], tier: 3, cuisine: ["cocktails"] },
  { name: "Bar Part Time", hood: "The Mission", lat: 37.7583, lng: -122.4192, vibes: ["drink"], tier: 2, cuisine: ["wine bar"] },
  { name: "Yamo", hood: "The Mission", lat: 37.7635, lng: -122.4220, vibes: ["munch"], tier: 1, cuisine: ["burmese"] },
  { name: "Zuni Cafe", hood: "Hayes Valley", lat: 37.7734, lng: -122.4227, vibes: ["meal"], tier: 3, cuisine: ["californian"] },
  { name: "Rich Table", hood: "Hayes Valley", lat: 37.7761, lng: -122.4238, vibes: ["meal"], tier: 3, cuisine: ["californian"] },
  { name: "Smuggler's Cove", hood: "Hayes Valley", lat: 37.7790, lng: -122.4229, vibes: ["drink"], tier: 2, cuisine: ["tiki", "rum"] },
  { name: "Nopa", hood: "NoPa", lat: 37.7749, lng: -122.4374, vibes: ["meal"], tier: 3, cuisine: ["californian"] },
  { name: "Che Fico", hood: "NoPa", lat: 37.7761, lng: -122.4383, vibes: ["meal"], tier: 3, cuisine: ["italian"] },
  { name: "House of Prime Rib", hood: "Nob Hill", lat: 37.7930, lng: -122.4223, vibes: ["meal"], tier: 3, cuisine: ["steakhouse"] },
  { name: "Swan Oyster Depot", hood: "Nob Hill", lat: 37.7905, lng: -122.4204, vibes: ["meal"], tier: 3, cuisine: ["seafood"] },
  { name: "Acquerello", hood: "Nob Hill", lat: 37.7899, lng: -122.4222, vibes: ["meal"], tier: 4, cuisine: ["italian"] },
  { name: "Mister Jiu's", hood: "Chinatown", lat: 37.7947, lng: -122.4078, vibes: ["meal"], tier: 4, cuisine: ["chinese"] },
  { name: "Tony's Pizza Napoletana", hood: "North Beach", lat: 37.7996, lng: -122.4090, vibes: ["munch"], tier: 2, cuisine: ["pizza"] },
  { name: "Golden Boy Pizza", hood: "North Beach", lat: 37.7995, lng: -122.4076, vibes: ["munch", "snack"], tier: 1, cuisine: ["pizza"] },
  { name: "Liguria Bakery", hood: "North Beach", lat: 37.8005, lng: -122.4093, vibes: ["snack"], tier: 1, cuisine: ["bakery", "focaccia"] },
  { name: "Caffe Trieste", hood: "North Beach", lat: 37.7986, lng: -122.4073, vibes: ["snack", "drink"], tier: 1, cuisine: ["coffee"] },
  { name: "Comstock Saloon", hood: "North Beach", lat: 37.7972, lng: -122.4051, vibes: ["drink"], tier: 2, cuisine: ["cocktails"] },
  { name: "Sotto Mare", hood: "North Beach", lat: 37.7998, lng: -122.4080, vibes: ["meal"], tier: 3, cuisine: ["seafood", "italian"] },
  { name: "Molinari Delicatessen", hood: "North Beach", lat: 37.7987, lng: -122.4077, vibes: ["snack", "munch"], tier: 1, cuisine: ["deli", "sandwiches"] },
  { name: "Kokkari Estiatorio", hood: "Financial District", lat: 37.7970, lng: -122.3993, vibes: ["meal"], tier: 4, cuisine: ["greek"] },
  { name: "Benu", hood: "SoMa", lat: 37.7855, lng: -122.3993, vibes: ["meal"], tier: 4, cuisine: ["tasting menu"] },
  { name: "Brenda's French Soul Food", hood: "Tenderloin", lat: 37.7827, lng: -122.4189, vibes: ["snack", "meal"], tier: 2, cuisine: ["creole", "brunch"] },
  { name: "Saigon Sandwich", hood: "Tenderloin", lat: 37.7838, lng: -122.4159, vibes: ["snack", "munch"], tier: 1, cuisine: ["vietnamese", "banh mi"] },
  { name: "Bourbon & Branch", hood: "Tenderloin", lat: 37.7827, lng: -122.4143, vibes: ["drink"], tier: 3, cuisine: ["cocktails"] },
  { name: "Burma Superstar", hood: "Inner Richmond", lat: 37.7811, lng: -122.4640, vibes: ["meal", "munch"], tier: 2, cuisine: ["burmese"] },
  { name: "Good Luck Dim Sum", hood: "Inner Richmond", lat: 37.7808, lng: -122.4664, vibes: ["snack", "munch"], tier: 1, cuisine: ["dim sum", "chinese"] },
  { name: "Arsicault Bakery", hood: "Inner Richmond", lat: 37.7825, lng: -122.4600, vibes: ["snack"], tier: 1, cuisine: ["bakery", "croissant"] },
  { name: "Turtle Tower", hood: "Inner Richmond", lat: 37.7801, lng: -122.4643, vibes: ["munch"], tier: 1, cuisine: ["vietnamese", "pho"] },
  { name: "San Tung", hood: "Inner Sunset", lat: 37.7638, lng: -122.4700, vibes: ["munch", "meal"], tier: 2, cuisine: ["chinese", "chicken wings"] },
  { name: "Nopalito", hood: "Inner Sunset", lat: 37.7639, lng: -122.4665, vibes: ["meal", "munch"], tier: 2, cuisine: ["mexican"] },
  { name: "Marufuku Ramen", hood: "Japantown", lat: 37.7852, lng: -122.4297, vibes: ["munch"], tier: 2, cuisine: ["ramen", "japanese"] },
  { name: "State Bird Provisions", hood: "Fillmore", lat: 37.7827, lng: -122.4382, vibes: ["meal"], tier: 3, cuisine: ["californian"] },
  { name: "b. patisserie", hood: "Lower Pacific Heights", lat: 37.7880, lng: -122.4407, vibes: ["snack"], tier: 2, cuisine: ["bakery", "pastry"] },
  { name: "Zazie", hood: "Cole Valley", lat: 37.7663, lng: -122.4500, vibes: ["meal", "snack"], tier: 2, cuisine: ["french", "brunch"] },
  { name: "Anchor Oyster Bar", hood: "The Castro", lat: 37.7607, lng: -122.4344, vibes: ["meal"], tier: 3, cuisine: ["seafood"] },
  { name: "Frances", hood: "The Castro", lat: 37.7614, lng: -122.4337, vibes: ["meal"], tier: 3, cuisine: ["californian"] },
  { name: "Andytown Coffee Roasters", hood: "Outer Sunset", lat: 37.7554, lng: -122.5045, vibes: ["snack", "drink"], tier: 1, cuisine: ["coffee"] },
  { name: "Devil's Teeth Baking Company", hood: "Outer Sunset", lat: 37.7534, lng: -122.5045, vibes: ["snack"], tier: 1, cuisine: ["bakery"] },
  { name: "Greens Restaurant", hood: "Marina", lat: 37.8064, lng: -122.4325, vibes: ["meal"], tier: 3, cuisine: ["vegetarian"] },
  { name: "Tacolicious", hood: "Marina", lat: 37.8000, lng: -122.4363, vibes: ["munch"], tier: 2, cuisine: ["mexican", "tacos"] },
];

const FLAG = "ts.seeded.sf.v1";

export async function seedLocalIfNeeded(): Promise<void> {
  if (localStorage.getItem(FLAG)) return;
  try {
    await db.upsertRestaurants(
      SF.map((s) => ({
        name: s.name,
        slug: slugify(s.name, "sf"),
        city: "San Francisco",
        neighborhood: s.hood,
        lat: s.lat,
        lng: s.lng,
        cuisine_tags: s.cuisine,
        vibe_tags: s.vibes,
        price_tier: s.tier,
      })),
    );
    localStorage.setItem(FLAG, "1");
    console.info(`[seed] ${SF.length} SF restaurants ready`);
  } catch (e) {
    console.warn("[seed] failed", e);
  }
}

export const SF_SEED_COUNT = SF.length;
