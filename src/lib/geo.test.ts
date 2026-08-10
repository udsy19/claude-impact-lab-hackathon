import { describe, expect, it } from "vitest";

import {
  boundingBox,
  distanceLabel,
  haversineMiles,
  randomSlug,
  slugify,
  walkMinutes,
  withinRadius,
  type LatLng,
} from "./geo.ts";

const FERRY_BUILDING: LatLng = { lat: 37.7955, lng: -122.3937 };
const GOLDEN_GATE_BRIDGE: LatLng = { lat: 37.8199, lng: -122.4783 };
const NYC: LatLng = { lat: 40.7128, lng: -74.006 };
const LA: LatLng = { lat: 34.0522, lng: -118.2437 };
const LONDON: LatLng = { lat: 51.5074, lng: -0.1278 };
const PARIS: LatLng = { lat: 48.8566, lng: 2.3522 };

describe("haversineMiles — known real-world distances", () => {
  it("SF Ferry Building to Golden Gate Bridge is ~4.92 mi", () => {
    expect(haversineMiles(FERRY_BUILDING, GOLDEN_GATE_BRIDGE)).toBeCloseTo(4.92, 1);
  });

  it("NYC to LA is ~2446 mi", () => {
    expect(haversineMiles(NYC, LA)).toBeCloseTo(2446, -1);
  });

  it("London to Paris is ~213.5 mi", () => {
    expect(haversineMiles(LONDON, PARIS)).toBeCloseTo(213.5, 0);
  });

  it("is symmetric", () => {
    expect(haversineMiles(NYC, LA)).toBeCloseTo(haversineMiles(LA, NYC), 9);
  });

  it("returns exactly 0 for identical points", () => {
    expect(haversineMiles(NYC, { ...NYC })).toBe(0);
  });

  it("returns half the Earth's circumference for antipodes, not NaN", () => {
    // asin() is clamped at 1, so the antipodal edge case stays finite.
    expect(haversineMiles({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(12436.8, 1);
    expect(haversineMiles({ lat: -90, lng: 0 }, { lat: 90, lng: 0 })).toBeCloseTo(12436.8, 1);
  });

  it("converts a small latitude delta at the documented 69.093 mi/deg", () => {
    // 0.0027 deg latitude == ~300 m == ~0.1865 mi. The match scorer's distance
    // gate depends on this exact conversion.
    expect(haversineMiles({ lat: 37.7749, lng: -122.4194 }, { lat: 37.7776, lng: -122.4194 })).toBeCloseTo(
      0.18655,
      4,
    );
  });
});

describe("haversineMiles — degenerate input returns Infinity, never NaN", () => {
  const bad: unknown[] = [
    { lat: Number.NaN, lng: 0 },
    { lat: 0, lng: Number.NaN },
    { lat: Infinity, lng: 0 },
    { lat: -Infinity, lng: -Infinity },
    null,
    undefined,
    {},
  ];

  it("yields +Infinity so a broken row sorts last", () => {
    for (const b of bad) {
      const d = haversineMiles(NYC, b as LatLng);
      expect(d, `haversineMiles(NYC, ${JSON.stringify(b)})`).toBe(Number.POSITIVE_INFINITY);
      expect(haversineMiles(b as LatLng, NYC)).toBe(Number.POSITIVE_INFINITY);
    }
  });

  it("treats null island (0,0) as a real, finite location", () => {
    expect(haversineMiles({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBe(0);
  });
});

describe("boundingBox", () => {
  const lat = 37.7749;
  const lng = -122.4194;

  it("contains its own origin", () => {
    const box = boundingBox(lat, lng, 1);
    expect(box.minLat).toBeLessThanOrEqual(lat);
    expect(box.maxLat).toBeGreaterThanOrEqual(lat);
    expect(box.minLng).toBeLessThanOrEqual(lng);
    expect(box.maxLng).toBeGreaterThanOrEqual(lng);
  });

  it("spans 1/69.093 deg of latitude per mile of radius", () => {
    const box = boundingBox(lat, lng, 1);
    expect(box.maxLat - box.minLat).toBeCloseTo(2 / 69.09262, 5);
  });

  it("widens monotonically with radius", () => {
    const small = boundingBox(lat, lng, 1);
    const big = boundingBox(lat, lng, 5);
    expect(big.minLat).toBeLessThan(small.minLat);
    expect(big.maxLat).toBeGreaterThan(small.maxLat);
    expect(big.minLng).toBeLessThan(small.minLng);
    expect(big.maxLng).toBeGreaterThan(small.maxLng);
  });

  it("is a safe pre-filter: no point haversine calls 'inside' falls outside the box", () => {
    // The box must never drop a row exact haversine would have kept, or the
    // SQL BETWEEN pre-filter silently loses nearby restaurants.
    const radius = 2;
    const box = boundingBox(lat, lng, radius);
    let checked = 0;
    for (let bearing = 0; bearing < 360; bearing += 5) {
      for (const frac of [0.1, 0.5, 0.9, 0.999]) {
        const rad = (bearing * Math.PI) / 180;
        const miles = radius * frac;
        const dLat = (miles / 69.09262) * Math.cos(rad);
        const dLng = (miles / (69.09262 * Math.cos((lat * Math.PI) / 180))) * Math.sin(rad);
        const p = { lat: lat + dLat, lng: lng + dLng };
        if (haversineMiles({ lat, lng }, p) > radius) continue; // not "inside", box owes nothing
        checked += 1;
        const inside =
          p.lat >= box.minLat && p.lat <= box.maxLat && p.lng >= box.minLng && p.lng <= box.maxLng;
        expect(inside, `point at bearing ${bearing}, ${miles} mi escaped the box`).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it("widens longitude to the whole world at the pole instead of dividing by ~0", () => {
    const box = boundingBox(90, 0, 1);
    expect(box.minLng).toBe(-180);
    expect(box.maxLng).toBe(180);
    expect(box.maxLat).toBe(90);
  });

  it("widens longitude to the whole world rather than wrapping the antimeridian", () => {
    const box = boundingBox(0, 179.9, 50);
    expect(box.minLng).toBe(-180);
    expect(box.maxLng).toBe(180);
    expect(box.minLng).toBeLessThan(box.maxLng); // never an empty BETWEEN range
  });

  it("collapses to the origin point for a zero or negative radius", () => {
    expect(boundingBox(10, 20, 0)).toEqual({ minLat: 10, maxLat: 10, minLng: 20, maxLng: 20 });
    expect(boundingBox(10, 20, -5)).toEqual({ minLat: 10, maxLat: 10, minLng: 20, maxLng: 20 });
  });

  it("falls back to (0,0) with a zero radius for NaN input", () => {
    expect(boundingBox(Number.NaN, Number.NaN, Number.NaN)).toEqual({
      minLat: 0,
      maxLat: 0,
      minLng: 0,
      maxLng: 0,
    });
  });

  it("clamps out-of-range coordinates instead of producing an impossible box", () => {
    const box = boundingBox(200, 400, 1);
    expect(box.maxLat).toBeLessThanOrEqual(90);
    expect(box.minLat).toBeGreaterThanOrEqual(-90);
    expect(box.maxLng).toBeLessThanOrEqual(180);
    expect(box.minLng).toBeGreaterThanOrEqual(-180);
  });
});

describe("walkMinutes", () => {
  it("uses 20 minutes per mile", () => {
    expect(walkMinutes(1)).toBe(20);
    expect(walkMinutes(0.5)).toBe(10);
    expect(walkMinutes(3)).toBe(60);
  });

  it("rounds to a whole minute", () => {
    expect(walkMinutes(0.024)).toBe(0); // 0.48 min
    expect(walkMinutes(0.026)).toBe(1); // 0.52 min
  });

  it("returns 0 for zero, negative, NaN and Infinity", () => {
    expect(walkMinutes(0)).toBe(0);
    expect(walkMinutes(-1)).toBe(0);
    expect(walkMinutes(Number.NaN)).toBe(0);
    expect(walkMinutes(Infinity)).toBe(0);
  });
});

describe("distanceLabel — the 1-mile boundary", () => {
  it("shows a walk time just under a mile", () => {
    expect(distanceLabel(0.999)).toBe("20-min walk");
    expect(distanceLabel(0.5)).toBe("10-min walk");
    expect(distanceLabel(0.25)).toBe("5-min walk");
  });

  it("switches to miles at exactly 1 mile", () => {
    expect(distanceLabel(1)).toBe("1.0 mi");
    expect(distanceLabel(1.26)).toBe("1.3 mi");
    expect(distanceLabel(12.34)).toBe("12.3 mi");
  });

  it("never claims a 0-minute walk", () => {
    expect(distanceLabel(0)).toBe("1-min walk");
    expect(distanceLabel(0.001)).toBe("1-min walk");
  });

  it("degrades to 'distance unknown' rather than printing NaN or Infinity", () => {
    expect(distanceLabel(Number.NaN)).toBe("distance unknown");
    expect(distanceLabel(Infinity)).toBe("distance unknown");
    expect(distanceLabel(-1)).toBe("distance unknown");
  });
});

describe("withinRadius", () => {
  const rows = [
    { id: "far", lat: 37.8199, lng: -122.4783 }, // GGB, ~4.9 mi from Ferry Building
    { id: "near", lat: 37.7955, lng: -122.3937 }, // Ferry Building itself
    { id: "mid", lat: 37.7749, lng: -122.4194 }, // ~2.1 mi
    { id: "nocoords", lat: null, lng: null },
  ];

  it("keeps only rows inside the radius, nearest first", () => {
    expect(withinRadius(rows, FERRY_BUILDING, 3).map((r) => r.id)).toEqual(["near", "mid"]);
  });

  it("drops rows without coordinates", () => {
    expect(withinRadius(rows, FERRY_BUILDING, 10000).map((r) => r.id)).not.toContain("nocoords");
  });

  it("honours the limit", () => {
    expect(withinRadius(rows, FERRY_BUILDING, 10, 1).map((r) => r.id)).toEqual(["near"]);
    expect(withinRadius(rows, FERRY_BUILDING, 10, 0)).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(withinRadius([], FERRY_BUILDING, 5)).toEqual([]);
  });
});

describe("slugify", () => {
  it("strips accents", () => {
    expect(slugify("La Taquería", "San Francisco")).toBe("la-taqueria-sf");
    expect(slugify("Café Toma")).toBe("cafe-toma");
  });

  it("collapses accent variants of one name onto the same slug (upsert stability)", () => {
    expect(slugify("Café Toma", "San Francisco")).toBe(slugify("Cafe Toma", "San Francisco"));
  });

  it("drops apostrophes instead of turning them into separators", () => {
    expect(slugify("Joe's Pizza", "New York")).toBe("joes-pizza-ny");
    expect(slugify("Joe’s Pizza", "New York")).toBe("joes-pizza-ny");
  });

  it("expands ampersands to 'and'", () => {
    expect(slugify("Salt & Straw", "Portland")).toBe("salt-and-straw-portland");
  });

  it("uses initials for multi-word cities and the whole word for single-word cities", () => {
    expect(slugify("Tacos El Rey", "San Francisco")).toBe("tacos-el-rey-sf");
    expect(slugify("Tacos El Rey", "Oakland")).toBe("tacos-el-rey-oakland");
    expect(slugify("Tacos El Rey", "New York City Area")).toBe("tacos-el-rey-nyca");
  });

  it("separates the same name in different cities", () => {
    expect(slugify("Tacos El Rey", "San Francisco")).not.toBe(slugify("Tacos El Rey", "Oakland"));
  });

  it("falls back to 'unnamed' for an empty or punctuation-only name", () => {
    expect(slugify("")).toBe("unnamed");
    expect(slugify("", "Oakland")).toBe("unnamed-oakland");
    expect(slugify("!!!", "SF")).toBe("unnamed-sf");
    expect(slugify("🍕")).toBe("unnamed");
  });

  it("omits the suffix when no city is given", () => {
    expect(slugify("Zuni Cafe")).toBe("zuni-cafe");
    expect(slugify("Zuni Cafe", null)).toBe("zuni-cafe");
    expect(slugify("Zuni Cafe", "")).toBe("zuni-cafe");
  });

  it("is deterministic across calls", () => {
    expect(slugify("La Taquería", "San Francisco")).toBe(slugify("La Taquería", "San Francisco"));
  });

  it("caps the name at 80 characters", () => {
    const stem = slugify("x".repeat(200));
    expect(stem).toHaveLength(80);
  });

  it("survives a non-string name", () => {
    expect(slugify(null as unknown as string)).toBe("unnamed");
    expect(slugify(undefined as unknown as string, "Oakland")).toBe("unnamed-oakland");
  });
});

describe("randomSlug", () => {
  it("returns the requested length using only url-safe characters", () => {
    for (const n of [1, 10, 32, 64]) {
      const s = randomSlug(n);
      expect(s).toHaveLength(n);
      expect(s).toMatch(/^[a-z0-9]+$/);
    }
  });

  it("clamps out-of-range lengths instead of hanging or returning empty", () => {
    expect(randomSlug(0)).toHaveLength(1);
    expect(randomSlug(-5)).toHaveLength(1);
    expect(randomSlug(1000)).toHaveLength(64);
  });

  it("defaults to 10 characters", () => {
    expect(randomSlug()).toHaveLength(10);
  });
});
