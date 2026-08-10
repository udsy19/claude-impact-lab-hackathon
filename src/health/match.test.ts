import { describe, expect, it } from "vitest";

import {
  CONFIDENCE_THRESHOLD,
  matchConfidence,
  nameSimilarity,
  searchTokens,
} from "./match.ts";

/** Shared fixtures: two points ~33m apart in SF, and one in NYC. */
const SF = { lat: 37.7509, lng: -122.4183 };
const SF_SAME_ADDRESS = { lat: 37.7512, lng: -122.4183 };
const NYC = { lat: 40.7223, lng: -73.9874 };

/*
 * Regression: normalizeName used to strip EVERY trailing numeral, so
 * "Cafe 1951" and "Cafe 2020" both became "cafe", scored 1.00, and at a shared
 * address produced a confident match on the WRONG restaurant's inspection
 * record. A number is now only stripped when marked as a branch ("#2",
 * "no. 2", "store 4"). These assert the refusal directly.
 */
describe("numbered names must not collapse into each other", () => {
  it("should refuse 'Cafe 1951' vs 'Cafe 2020' at the same address ", () => {
    expect(
      matchConfidence({
        queryName: "Cafe 1951",
        candidateName: "Cafe 2020",
        queryCoords: SF,
        candidateCoords: SF_SAME_ADDRESS,
      }),
    ).toBeLessThan(CONFIDENCE_THRESHOLD);
  });

  it("should refuse 'Pier 23' vs 'Pier 39' at the same address ", () => {
    expect(
      matchConfidence({
        queryName: "Pier 23",
        candidateName: "Pier 39",
        queryCoords: SF,
        candidateCoords: SF_SAME_ADDRESS,
      }),
    ).toBeLessThan(CONFIDENCE_THRESHOLD);
  });

  it("should not call 'Studio 54' and 'Studio 90' the same name", () => {
    expect(nameSimilarity("Studio 54", "Studio 90")).toBeLessThan(1);
  });

  it("does still strip an explicit store number, which is the intended behaviour", () => {
    expect(nameSimilarity("Shake Shack #2", "Shake Shack")).toBe(1);
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
