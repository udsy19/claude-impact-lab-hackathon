import { describe, expect, it } from "vitest";

import {
  CONFIDENCE_THRESHOLD,
  matchConfidence,
  nameSimilarity,
  searchTokens,
} from "./match.ts";

/**
 * The single question this file protects: can a wrong inspection record ever
 * clear CONFIDENCE_THRESHOLD? A false positive here prints another
 * restaurant's rat citations on this restaurant's brief.
 */

// A block in the Mission, SF. Latitude deltas are exact metre distances at
// 69.093 miles per degree of latitude.
const SF = { lat: 37.7749, lng: -122.4194 };
/** +0.0003 deg lat == ~33 m: "same address" band (<=50m). */
const SF_SAME_ADDRESS = { lat: 37.7752, lng: -122.4194 };
/** +0.0027 deg lat == ~300 m: past the 250 m gate. */
const SF_300M = { lat: 37.7776, lng: -122.4194 };
const NYC = { lat: 40.7128, lng: -74.006 };

describe("matchConfidence — records we MUST be willing to show", () => {
  it("accepts an exact name at the same address", () => {
    const c = matchConfidence({
      queryName: "Zuni Cafe",
      candidateName: "Zuni Cafe",
      queryCoords: SF,
      candidateCoords: SF_SAME_ADDRESS,
    });
    expect(c).toBe(1);
    expect(c).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
  });

  it("accepts 'Peter Luger' against 'Peter Luger Steakhouse' at the same address (subset containment)", () => {
    const c = matchConfidence({
      queryName: "Peter Luger",
      candidateName: "Peter Luger Steakhouse",
      queryCoords: NYC,
      candidateCoords: { lat: 40.7131, lng: -74.006 }, // ~33 m
    });
    expect(c).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    expect(c).toBeCloseTo(0.98, 5);
  });

  it("accepts an exact name when neither side has coordinates", () => {
    const c = matchConfidence({
      queryName: "Katz's Delicatessen",
      candidateName: "KATZ'S DELICATESSEN",
      queryCoords: null,
      candidateCoords: null,
    });
    expect(c).toBeCloseTo(0.88, 5);
    expect(c).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
  });

  it("accepts an exact name when we have coords but the record does not", () => {
    const c = matchConfidence({
      queryName: "Tartine Bakery",
      candidateName: "Tartine Bakery",
      queryCoords: SF,
      candidateCoords: null,
    });
    expect(c).toBeCloseTo(0.8, 5);
    expect(c).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
  });
});

describe("matchConfidence — records we MUST refuse (safety cases)", () => {
  it("refuses a perfect name match 300 m away (distance is a gate, not a tiebreak)", () => {
    const c = matchConfidence({
      queryName: "Zuni Cafe",
      candidateName: "Zuni Cafe",
      queryCoords: SF,
      candidateCoords: SF_300M,
    });
    expect(c).toBeLessThan(CONFIDENCE_THRESHOLD);
    expect(c).toBeCloseTo(0.6, 5); // hard ceiling for the 250-600 m band
  });

  it("refuses a perfect name match 1.1 km away", () => {
    const c = matchConfidence({
      queryName: "Zuni Cafe",
      candidateName: "Zuni Cafe",
      queryCoords: SF,
      candidateCoords: { lat: 37.7849, lng: -122.4194 }, // ~1112 m
    });
    expect(c).toBeLessThan(CONFIDENCE_THRESHOLD);
    expect(c).toBeCloseTo(0.4, 5);
  });

  it("refuses the generic query name 'Kitchen' sitting exactly on top of a longer candidate", () => {
    const c = matchConfidence({
      queryName: "Kitchen",
      candidateName: "The Kitchen Table",
      queryCoords: SF,
      candidateCoords: SF_SAME_ADDRESS,
    });
    expect(c).toBeLessThan(CONFIDENCE_THRESHOLD);
    expect(c).toBeCloseTo(0.65, 5); // generic-name ceiling
  });

  it("refuses the generic query name 'Thai Food' sitting exactly on top of a longer candidate", () => {
    const c = matchConfidence({
      queryName: "Thai Food",
      candidateName: "Thai Food Express",
      queryCoords: SF,
      candidateCoords: SF_SAME_ADDRESS,
    });
    expect(c).toBeLessThan(CONFIDENCE_THRESHOLD);
    expect(c).toBeCloseTo(0.65, 5);
  });

  it("refuses an exact but too-short distinctive query name ('Nix') at the same address", () => {
    const c = matchConfidence({
      queryName: "Nix",
      candidateName: "Nix",
      queryCoords: SF,
      candidateCoords: SF_SAME_ADDRESS,
    });
    expect(c).toBeLessThan(CONFIDENCE_THRESHOLD);
    expect(c).toBeCloseTo(0.7, 5); // short-name ceiling
  });

  it("refuses two genuinely different restaurants sharing one address", () => {
    const c = matchConfidence({
      queryName: "Katz's Delicatessen",
      candidateName: "Russ & Daughters Cafe",
      queryCoords: NYC,
      candidateCoords: NYC,
    });
    expect(c).toBeLessThan(CONFIDENCE_THRESHOLD);
    expect(c).toBeLessThan(0.4);
  });

  it("refuses two different restaurants sharing one address and one generic word", () => {
    const c = matchConfidence({
      queryName: "Golden Gate Grill",
      candidateName: "Silver Star Grill",
      queryCoords: SF,
      candidateCoords: SF,
    });
    expect(c).toBeLessThan(CONFIDENCE_THRESHOLD);
  });

  it("refuses 'Tartine Bakery' (SF) scored against a same-named candidate at NYC coords", () => {
    const c = matchConfidence({
      queryName: "Tartine Bakery",
      candidateName: "Tartine Bakery",
      queryCoords: SF,
      candidateCoords: NYC,
    });
    expect(c).toBeLessThan(CONFIDENCE_THRESHOLD);
    expect(c).toBeCloseTo(0.15, 5); // >2 km band
  });

  it("returns 0 outright when the names have nothing in common", () => {
    expect(
      matchConfidence({
        queryName: "🍕🍕🍕",
        candidateName: "Zuni Cafe",
        queryCoords: SF,
        candidateCoords: SF,
      }),
    ).toBe(0);
  });

  it("treats null island (0,0) as no coordinates rather than as a real address", () => {
    const nullIsland = matchConfidence({
      queryName: "Zuni Cafe",
      candidateName: "Zuni Cafe",
      queryCoords: SF,
      candidateCoords: { lat: 0, lng: 0 },
    });
    const missing = matchConfidence({
      queryName: "Zuni Cafe",
      candidateName: "Zuni Cafe",
      queryCoords: SF,
      candidateCoords: null,
    });
    expect(nullIsland).toBe(missing);
  });

  it("treats NaN coordinates as missing rather than throwing or scoring them as near", () => {
    const c = matchConfidence({
      queryName: "Zuni Cafe",
      candidateName: "Zuni Cafe",
      queryCoords: SF,
      candidateCoords: { lat: Number.NaN, lng: Number.NaN },
    });
    expect(c).toBeCloseTo(0.8, 5);
  });
});

describe("nameSimilarity — normalisation", () => {
  it("ignores case", () => {
    expect(nameSimilarity("zuni cafe", "ZUNI CAFE")).toBe(1);
  });

  it("ignores accents: 'Café Toma' == 'Cafe Toma'", () => {
    expect(nameSimilarity("Café Toma", "Cafe Toma")).toBe(1);
  });

  it("ignores apostrophes: \"Joe's Pizza\" == 'Joes Pizza'", () => {
    expect(nameSimilarity("Joe's Pizza", "Joes Pizza")).toBe(1);
    expect(nameSimilarity("Joe’s Pizza", "Joes Pizza")).toBe(1);
  });

  it("expands ampersands: 'Salt & Straw' == 'Salt and Straw'", () => {
    expect(nameSimilarity("Salt & Straw", "Salt and Straw")).toBe(1);
  });

  it("drops corporate noise tokens: 'Zuni Cafe' == 'Zuni Cafe Restaurant Inc'", () => {
    expect(nameSimilarity("Zuni Cafe", "Zuni Cafe Restaurant Inc")).toBe(1);
  });

  it("strips a trailing store number: 'Shake Shack #2' == 'Shake Shack'", () => {
    expect(nameSimilarity("Shake Shack #2", "Shake Shack")).toBe(1);
  });

  it("strips a spelled-out trailing store number: 'Shake Shack No 3' == 'Shake Shack'", () => {
    expect(nameSimilarity("Shake Shack No 3", "Shake Shack")).toBe(1);
  });

  it("scores a subset name high but below an exact match", () => {
    const subset = nameSimilarity("Peter Luger", "Peter Luger Steakhouse");
    expect(subset).toBeCloseTo(0.9, 5);
    expect(subset).toBeLessThan(1);
  });

  it("scores unrelated names low", () => {
    expect(nameSimilarity("Zuni Cafe", "Nopalito")).toBeLessThan(0.3);
  });
});

describe("nameSimilarity — total function contract", () => {
  const inputs = [
    "",
    " ",
    "a",
    "Zuni Cafe",
    "ZUNI CAFE RESTAURANT INC",
    "Café Toma",
    "Joe's Pizza",
    "🍕🍜🥟",
    "北京烤鸭",
    "!!!???",
    "Shake Shack #2",
    "a".repeat(2000),
    "b".repeat(2000),
  ];

  it("returns a finite number within [0,1] for every pair of degenerate inputs", () => {
    for (const a of inputs) {
      for (const b of inputs) {
        const s = nameSimilarity(a, b);
        expect(Number.isFinite(s), `nameSimilarity(${JSON.stringify(a.slice(0, 20))}, ${JSON.stringify(b.slice(0, 20))}) was not finite`).toBe(true);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is symmetric for every pair", () => {
    for (const a of inputs) {
      for (const b of inputs) {
        expect(
          nameSimilarity(a, b),
          `asymmetric for ${JSON.stringify(a.slice(0, 20))} / ${JSON.stringify(b.slice(0, 20))}`,
        ).toBeCloseTo(nameSimilarity(b, a), 12);
      }
    }
  });

  it("returns 0 when either side normalises to nothing", () => {
    expect(nameSimilarity("", "Zuni Cafe")).toBe(0);
    expect(nameSimilarity("Zuni Cafe", "")).toBe(0);
    expect(nameSimilarity("", "")).toBe(0);
    expect(nameSimilarity("🍕", "🍕")).toBe(0);
    expect(nameSimilarity("!!!", "???")).toBe(0);
  });

  it("never throws on very long input", () => {
    expect(() => nameSimilarity("x".repeat(5000), "y".repeat(5000))).not.toThrow();
  });
});

describe("matchConfidence — total function contract", () => {
  it("stays within [0,1] for degenerate names and coordinates", () => {
    const names = ["", "Zuni Cafe", "🍕", "a".repeat(500)];
    const coords = [
      null,
      undefined,
      { lat: 0, lng: 0 },
      { lat: Number.NaN, lng: 0 },
      { lat: Infinity, lng: Infinity },
      SF,
      NYC,
    ];
    for (const queryName of names) {
      for (const candidateName of names) {
        for (const queryCoords of coords) {
          for (const candidateCoords of coords) {
            const c = matchConfidence({ queryName, candidateName, queryCoords, candidateCoords });
            expect(Number.isFinite(c)).toBe(true);
            expect(c).toBeGreaterThanOrEqual(0);
            expect(c).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});

describe("searchTokens", () => {
  it("keeps distinctive chunks, longest first, uppercased", () => {
    expect(searchTokens("Katz's Delicatessen")).toEqual(["DELICATESSEN", "KATZ"]);
  });

  it("drops noise words and sub-3-character chunks", () => {
    expect(searchTokens("The Zuni Cafe Inc")).toEqual(["ZUNI"]);
  });

  it("falls back to generic chunks when nothing distinctive is left", () => {
    expect(searchTokens("The Thai Kitchen")).toEqual(["KITCHEN", "THAI"]);
  });

  it("de-accents before tokenising", () => {
    expect(searchTokens("Café Toma")).toEqual(["TOMA"]);
  });

  it("de-duplicates repeated chunks", () => {
    expect(searchTokens("Pizza Pizza")).toEqual(["PIZZA"]);
  });

  it("returns an empty array for a name with no usable chunks", () => {
    expect(searchTokens("")).toEqual([]);
    expect(searchTokens("🍕 #2")).toEqual([]);
  });
});
