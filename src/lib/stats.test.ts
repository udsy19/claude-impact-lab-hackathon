import { describe, expect, it } from "vitest";

import type { Finding, ParsedReview } from "../types";
import {
  averageRating,
  bucketKeyFor,
  bucketLabel,
  bucketModeFor,
  dateRange,
  mentionHeat,
  pulseEventDate,
  ratedCount,
  ratingDistribution,
  ratingOverTime,
} from "./stats.ts";

/** Terse review builder — only date/stars/text ever matter to these functions. */
const rev = (date: string | null, stars: number | null, text = "a review"): ParsedReview => ({
  date,
  stars,
  text,
  source: "example.com",
});

/**
 * The reference corpus. 12 reviews, hand-checked:
 *   - 11 carry a usable star rating (one has `stars: null`)
 *   -  9 carry BOTH a star rating and a parseable date
 *   - spans 2025-01-15 .. 2025-11-30 (319 days) -> quarter bucketing
 *   - Q2 2025 is deliberately empty and must be omitted, not interpolated
 *   - the latest *dated* review (2025-12-14) is unrated, so dateRange and
 *     ratingOverTime must disagree about where the data ends
 */
const CORPUS: ParsedReview[] = [
  rev("2025-01-15", 5),
  rev("2025-02-10", 4),
  rev("2025-03-05", 3),
  rev("2025-07-04", 2),
  rev("2025-08-11", 3),
  rev("2025-09-02", 1),
  rev("2025-10-19", 5),
  rev("2025-11-08", 4),
  rev("2025-11-30", 5),
  rev(null, 4), // rated, undated
  rev("2025-12-14", null), // dated, unrated
  rev("not-a-date", 2), // rated, unparseable date
];

// ------------------------------------------------------------- distribution

describe("ratingDistribution", () => {
  it("returns exactly five rows, 5 down to 1, in that order", () => {
    expect(ratingDistribution(CORPUS).map((r) => r.star)).toEqual([5, 4, 3, 2, 1]);
  });

  it("counts every rated review and excludes the unrated one", () => {
    expect(ratingDistribution(CORPUS).map((r) => r.count)).toEqual([3, 3, 2, 2, 1]);
  });

  it("computes percentages of the rated subset (11), not the raw review count (12)", () => {
    expect(ratingDistribution(CORPUS).map((r) => r.pct)).toEqual([27.3, 27.3, 18.2, 18.2, 9.1]);
  });

  it("keeps all five rows with zero counts when nothing is rated", () => {
    const bars = ratingDistribution([rev("2025-01-01", null), rev(null, null)]);
    expect(bars).toEqual([
      { star: 5, count: 0, pct: 0 },
      { star: 4, count: 0, pct: 0 },
      { star: 3, count: 0, pct: 0 },
      { star: 2, count: 0, pct: 0 },
      { star: 1, count: 0, pct: 0 },
    ]);
  });

  it("rejects out-of-range and non-numeric star values", () => {
    const junk = [
      rev(null, 0),
      rev(null, 6),
      rev(null, -3),
      rev(null, Number.NaN),
      rev(null, Infinity),
      rev(null, "4" as unknown as number),
      rev(null, undefined as unknown as null),
    ];
    expect(ratingDistribution(junk).map((r) => r.count)).toEqual([0, 0, 0, 0, 0]);
    expect(ratedCount(junk)).toBe(0);
  });

  it("rounds fractional star values to the nearest bucket", () => {
    const bars = ratingDistribution([rev(null, 4.4), rev(null, 4.6), rev(null, 1.2)]);
    expect(bars.map((r) => r.count)).toEqual([1, 1, 0, 0, 1]);
  });

  it("returns five empty rows for an empty array", () => {
    expect(ratingDistribution([]).map((r) => [r.star, r.count, r.pct])).toEqual([
      [5, 0, 0],
      [4, 0, 0],
      [3, 0, 0],
      [2, 0, 0],
      [1, 0, 0],
    ]);
  });
});

describe("ratedCount", () => {
  it("counts only reviews with a usable 1-5 rating", () => {
    expect(ratedCount(CORPUS)).toBe(11);
  });

  it("returns 0 for an empty array", () => {
    expect(ratedCount([])).toBe(0);
  });
});

describe("averageRating", () => {
  it("averages the rated subset to two decimals (38/11)", () => {
    expect(averageRating(CORPUS)).toBe(3.45);
  });

  it("returns null rather than NaN when nothing is rated", () => {
    expect(averageRating([rev("2025-01-01", null)])).toBeNull();
    expect(averageRating([])).toBeNull();
  });

  it("handles a single review", () => {
    expect(averageRating([rev("2025-01-01", 4)])).toBe(4);
  });
});

// ----------------------------------------------------------------- over time

describe("bucketKeyFor / bucketLabel", () => {
  it("maps months to the right quarter", () => {
    expect(bucketKeyFor("2026-01-31", "quarter")).toBe("2026-Q1");
    expect(bucketKeyFor("2026-03-01", "quarter")).toBe("2026-Q1");
    expect(bucketKeyFor("2026-04-01", "quarter")).toBe("2026-Q2");
    expect(bucketKeyFor("2026-12-31", "quarter")).toBe("2026-Q4");
  });

  it("zero-pads month keys so they sort lexicographically", () => {
    const keys = ["2026-11-05", "2026-01-05", "2026-09-05"].map((d) => bucketKeyFor(d, "month"));
    expect(keys).toEqual(["2026-11", "2026-01", "2026-09"]);
    expect([...keys].sort()).toEqual(["2026-01", "2026-09", "2026-11"]);
  });

  it("accepts a year-month date with no day", () => {
    expect(bucketKeyFor("2026-05", "month")).toBe("2026-05");
  });

  it("returns null for unusable dates instead of guessing", () => {
    for (const bad of [null, "", "yesterday", "2026-13-01", "2026-00-05", "1899-05-01", "20260501"]) {
      expect(bucketKeyFor(bad, "quarter"), `bucketKeyFor(${JSON.stringify(bad)})`).toBeNull();
    }
  });

  it("renders human labels", () => {
    expect(bucketLabel("2026-Q2")).toBe("Q2 '26");
    expect(bucketLabel("2026-05")).toBe("May '26");
    expect(bucketLabel("2026-01")).toBe("Jan '26");
    expect(bucketLabel("2026-12")).toBe("Dec '26");
  });

  it("falls back to the raw key when it cannot be parsed", () => {
    expect(bucketLabel("garbage")).toBe("garbage");
    expect(bucketLabel("2026-Q5")).toBe("2026-Q5");
    expect(bucketLabel("2026-13")).toBe("2026-13");
  });
});

describe("bucketModeFor", () => {
  it("uses quarters for a span over ~9 months", () => {
    expect(bucketModeFor(CORPUS)).toBe("quarter");
  });

  it("uses months for a short span", () => {
    expect(bucketModeFor([rev("2026-01-05", 4), rev("2026-03-02", 5)])).toBe("month");
  });

  it("switches at the 274-day boundary", () => {
    expect(bucketModeFor([rev("2025-01-01", 4), rev("2025-10-01", 4)])).toBe("month"); // 273 days
    expect(bucketModeFor([rev("2025-01-01", 4), rev("2025-10-02", 4)])).toBe("quarter"); // 274 days
  });

  it("ignores undated and unrated reviews when measuring the span", () => {
    expect(
      bucketModeFor([rev("2026-01-05", 4), rev("2026-02-02", 5), rev("2010-01-01", null)]),
    ).toBe("month");
  });

  it("defaults to quarter when there is nothing to measure", () => {
    expect(bucketModeFor([])).toBe("quarter");
    expect(bucketModeFor([rev(null, 4)])).toBe("quarter");
  });
});

describe("ratingOverTime", () => {
  it("buckets a 10-month span by quarter with exact averages and counts", () => {
    expect(ratingOverTime(CORPUS)).toEqual([
      { bucket: "2025-Q1", label: "Q1 '25", avg: 4, n: 3 },
      { bucket: "2025-Q3", label: "Q3 '25", avg: 2, n: 3 },
      { bucket: "2025-Q4", label: "Q4 '25", avg: 4.67, n: 3 },
    ]);
  });

  it("omits the empty quarter (Q2 2025) instead of drawing through it", () => {
    expect(ratingOverTime(CORPUS).map((b) => b.bucket)).not.toContain("2025-Q2");
  });

  it("buckets a short span by month and omits empty months", () => {
    const short = [rev("2026-01-05", 4), rev("2026-01-20", 2), rev("2026-03-02", 5)];
    expect(ratingOverTime(short)).toEqual([
      { bucket: "2026-01", label: "Jan '26", avg: 3, n: 2 },
      { bucket: "2026-03", label: "Mar '26", avg: 5, n: 1 },
    ]);
  });

  it("returns buckets in chronological order regardless of input order", () => {
    const shuffled = [
      rev("2025-11-08", 4),
      rev("2025-01-15", 5),
      rev("2025-09-02", 1),
      rev("2025-03-05", 3),
    ];
    expect(ratingOverTime(shuffled).map((b) => b.bucket)).toEqual([
      "2025-Q1",
      "2025-Q3",
      "2025-Q4",
    ]);
  });

  it("orders buckets correctly across a year boundary", () => {
    const spanning = [rev("2026-02-01", 5), rev("2024-11-01", 1), rev("2025-06-01", 3)];
    expect(ratingOverTime(spanning).map((b) => b.bucket)).toEqual([
      "2024-Q4",
      "2025-Q2",
      "2026-Q1",
    ]);
  });

  it("excludes reviews missing a date or missing stars", () => {
    const totalN = ratingOverTime(CORPUS).reduce((sum, b) => sum + b.n, 0);
    expect(totalN).toBe(9); // 12 reviews, 11 rated, 9 both rated and dated
  });

  it("returns an empty array when no review has both a date and a rating", () => {
    expect(ratingOverTime([])).toEqual([]);
    expect(ratingOverTime([rev(null, 4), rev("2026-01-01", null), rev("nope", 3)])).toEqual([]);
  });
});

// --------------------------------------------------------------- mention heat

describe("mentionHeat", () => {
  const HEAT: ParsedReview[] = [
    rev("2026-01-01", 5, "The service was attentive and the food was delicious"),
    rev("2026-01-02", 1, "We waited forever and the server ignored us"),
    rev("2026-01-03", 3, "Loud atmosphere but the food was fine"),
    rev("2026-01-04", null, "Overpriced for what you get"),
    rev("2026-01-05", 5, ""), // no text: contributes nothing
  ];

  it("credits one review to every category it mentions", () => {
    const rows = mentionHeat(HEAT);
    const byCategory = Object.fromEntries(rows.map((r) => [r.category, r]));
    // review 2 hits pacing ("waited"/"forever"), staffing ("server") and service ("ignored")
    expect(byCategory.pacing.total).toBe(1);
    expect(byCategory.staffing.total).toBe(1);
    expect(byCategory.service.total).toBe(2);
    // review 1 and review 3 both mention food
    expect(byCategory.food.total).toBe(2);
  });

  it("splits sentiment by stars: >=4 positive, <=2 negative, 3 neither", () => {
    const byCategory = Object.fromEntries(mentionHeat(HEAT).map((r) => [r.category, r]));
    expect(byCategory.service).toEqual({ category: "service", positive: 1, negative: 1, total: 2 });
    // food is mentioned by a 5-star and a 3-star review: the 3-star is neutral
    expect(byCategory.food).toEqual({ category: "food", positive: 1, negative: 0, total: 2 });
    expect(byCategory.ambience).toEqual({
      category: "ambience",
      positive: 0,
      negative: 0,
      total: 1,
    });
  });

  it("falls back to word sentiment only for unrated reviews", () => {
    const byCategory = Object.fromEntries(mentionHeat(HEAT).map((r) => [r.category, r]));
    // "Overpriced" has no stars, so the negative word decides
    expect(byCategory.pricing).toEqual({ category: "pricing", positive: 0, negative: 1, total: 1 });
  });

  it("lets stars override the prose sentiment", () => {
    const rows = mentionHeat([rev("2026-01-01", 5, "the service was rude and terrible")]);
    expect(rows).toEqual([{ category: "service", positive: 1, negative: 0, total: 1 }]);
  });

  it("stays neutral for unrated prose that is both positive and negative", () => {
    const rows = mentionHeat([rev("2026-01-01", null, "great service but terrible food")]);
    const byCategory = Object.fromEntries(rows.map((r) => [r.category, r]));
    expect(byCategory.service).toEqual({ category: "service", positive: 0, negative: 0, total: 1 });
  });

  it("sorts by total descending, then category name", () => {
    expect(mentionHeat(HEAT).map((r) => r.category)).toEqual([
      "food",
      "service",
      "ambience",
      "pacing",
      "pricing",
      "staffing",
    ]);
  });

  it("drops categories nobody mentioned rather than showing a zero bar", () => {
    expect(mentionHeat(HEAT).map((r) => r.category)).not.toContain("consistency");
    expect(mentionHeat(HEAT).every((r) => r.total > 0)).toBe(true);
  });

  it("matches keywords on word boundaries, not substrings", () => {
    // "barely" must not count as the "bar" ambience/staffing keyword,
    // and "waiter" must not be swallowed by "wait".
    expect(mentionHeat([rev(null, 3, "barely worth mentioning")]).map((r) => r.category)).toEqual([]);
    expect(mentionHeat([rev(null, 3, "our waiter arrived")]).map((r) => r.category)).toEqual([
      "staffing",
    ]);
  });

  it("is case-insensitive", () => {
    expect(mentionHeat([rev(null, 3, "LOUD MUSIC")]).map((r) => r.category)).toEqual(["ambience"]);
  });

  it("ignores reviews with empty or non-string text", () => {
    expect(mentionHeat([rev(null, 5, ""), rev(null, 5, null as unknown as string)])).toEqual([]);
  });

  it("returns an empty array for an empty corpus", () => {
    expect(mentionHeat([])).toEqual([]);
  });
});

// ----------------------------------------------------------------- date range

describe("dateRange", () => {
  it("spans the earliest and latest dated review, rated or not", () => {
    expect(dateRange(CORPUS)).toEqual({
      from: "2025-01-15",
      to: "2025-12-14", // the unrated December review still bounds the range
      label: "Jan 2025 – Dec 2025",
    });
  });

  it("collapses the label when both ends land in one month", () => {
    expect(dateRange([rev("2026-03-02", 5), rev("2026-03-28", 1)])).toEqual({
      from: "2026-03-02",
      to: "2026-03-28",
      label: "Mar 2026",
    });
  });

  it("handles a single dated review", () => {
    expect(dateRange([rev("2026-07-04", 5)])).toEqual({
      from: "2026-07-04",
      to: "2026-07-04",
      label: "Jul 2026",
    });
  });

  it("ignores unparseable dates", () => {
    expect(dateRange([rev("not-a-date", 5), rev("2026-02-01", 4), rev(null, 3)])).toEqual({
      from: "2026-02-01",
      to: "2026-02-01",
      label: "Feb 2026",
    });
  });

  it("degrades to 'date range unknown' instead of guessing", () => {
    const unknown = { from: null, to: null, label: "date range unknown" };
    expect(dateRange([])).toEqual(unknown);
    expect(dateRange([rev(null, 5), rev("gibberish", 4)])).toEqual(unknown);
  });
});

// ------------------------------------------------------------------- pulse

describe("pulseEventDate", () => {
  const find = (date: string | null, finding: string, quote: string | null = null): Finding => ({
    finding,
    quote,
    source: "example.com",
    date,
  });

  it("returns the most recent dated discontinuity", () => {
    const findings = [
      find("2025-03-01", "New chef took over the kitchen"),
      find("2025-08-15", "Renovated the dining room"),
      find("2024-01-01", "Reopened after a fire"),
    ];
    expect(pulseEventDate(findings)).toEqual({
      date: "2025-08-15",
      finding: "Renovated the dining room",
    });
  });

  it("matches the discontinuity word in the quote as well as the finding", () => {
    expect(pulseEventDate([find("2025-05-01", "Ownership changed", "sold to a local group")])).toEqual(
      { date: "2025-05-01", finding: "Ownership changed" },
    );
  });

  it("ignores findings that describe no discontinuity", () => {
    expect(pulseEventDate([find("2026-01-01", "Servers are friendly", "the staff is great")])).toBeNull();
  });

  it("ignores discontinuities with no usable date", () => {
    expect(pulseEventDate([find(null, "New chef hired"), find("nope", "Renovated")])).toBeNull();
  });

  it("ignores a discontinuity whose finding text is empty", () => {
    expect(pulseEventDate([find("2026-01-01", "   ", "under new management")])).toBeNull();
  });

  it("trims the returned finding", () => {
    expect(pulseEventDate([find("2026-01-01", "  New chef  ")])?.finding).toBe("New chef");
  });

  it("returns null for an empty array", () => {
    expect(pulseEventDate([])).toBeNull();
  });
});

// -------------------------------------------------------- totality contract

describe("every exported function is total", () => {
  const junk = [null, undefined, {}, { stars: "5", date: 42, text: 7 }] as unknown as ParsedReview[];

  it("never throws on an array of malformed entries", () => {
    expect(() => ratingDistribution(junk)).not.toThrow();
    expect(() => ratedCount(junk)).not.toThrow();
    expect(() => averageRating(junk)).not.toThrow();
    expect(() => ratingOverTime(junk)).not.toThrow();
    expect(() => bucketModeFor(junk)).not.toThrow();
    expect(() => mentionHeat(junk)).not.toThrow();
    expect(() => dateRange(junk)).not.toThrow();
    expect(() => pulseEventDate(junk as unknown as Finding[])).not.toThrow();
  });

  it("never throws on a null/undefined corpus", () => {
    for (const nothing of [null, undefined] as unknown as ParsedReview[][]) {
      expect(() => ratingDistribution(nothing)).not.toThrow();
      expect(() => ratedCount(nothing)).not.toThrow();
      expect(() => averageRating(nothing)).not.toThrow();
      expect(() => ratingOverTime(nothing)).not.toThrow();
      expect(() => bucketModeFor(nothing)).not.toThrow();
      expect(() => mentionHeat(nothing)).not.toThrow();
      expect(() => dateRange(nothing)).not.toThrow();
      expect(() => pulseEventDate(nothing as unknown as Finding[])).not.toThrow();
    }
  });
});
