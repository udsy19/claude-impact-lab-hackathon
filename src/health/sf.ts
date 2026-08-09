/**
 * San Francisco adapter — DataSF "Restaurant Scores (LIVES Standard)".
 *
 * Verified against the live endpoint: the dataset is a snapshot that stops at
 * 2019-11-28, one row per violation, `business_location` is a real Socrata
 * point column (so `within_circle` works), and a good number of rows carry no
 * coordinates at all — hence the name-based fallback clause in runLookup.
 *
 * There is no letter grade in LIVES: `grade` is always null, `score` carries
 * the 0-100 `inspection_score`.
 */

import type { Health } from "../db/types.ts";
import {
  num,
  reportedInspection,
  runLookup,
  str,
  tidySummary,
  topCriticals,
  type DatasetSpec,
  type HealthLookupArgs,
  type Row,
} from "./index.ts";

const ENDPOINT = "https://data.sfgov.org/resource/pyih-qa8i.json";

/**
 * SF's high-risk vocabulary is a closed set of 16 phrases (confirmed by a
 * `$group=violation_description` sweep), so this maps the whole thing to plain
 * language rather than guessing with a regex. Severity: 1 worst -> 4 clerical.
 */
const HIGH_RISK: Record<string, { text: string; severity: number }> = {
  "high risk vermin infestation": { text: "Vermin infestation", severity: 1 },
  "sewage or wastewater contamination": { text: "Sewage or wastewater contamination", severity: 1 },
  "contaminated or adulterated food": { text: "Contaminated or adulterated food", severity: 1 },
  "unapproved food source": { text: "Food from an unapproved source", severity: 1 },
  "high risk food holding temperature": { text: "Food held at unsafe temperatures", severity: 2 },
  "improper cooling methods": { text: "Food not cooled down safely", severity: 2 },
  "improper reheating of food": { text: "Food not reheated properly", severity: 2 },
  "improper cooking time or temperatures": {
    text: "Food not cooked to a safe temperature",
    severity: 2,
  },
  "unauthorized or unsafe use of time as a public health control measure": {
    text: "Unsafe use of timing instead of temperature control",
    severity: 2,
  },
  "unclean or unsanitary food contact surfaces": {
    text: "Dirty food-contact surfaces",
    severity: 3,
  },
  "unclean hands or improper use of gloves": {
    text: "Poor handwashing or glove use by staff",
    severity: 3,
  },
  "no hot water or running water": { text: "No hot or running water", severity: 3 },
  "mobile food facility not operating with an approved commissary": {
    text: "Food truck without an approved commissary",
    severity: 4,
  },
  "mobile food facility with unapproved operating conditions": {
    text: "Food truck operating in unapproved conditions",
    severity: 4,
  },
  "no restroom facility within 200 feet of mobile food facility": {
    text: "No restroom near the food truck",
    severity: 4,
  },
  "other high risk violation": { text: "Other high-risk violation", severity: 4 },
};

const hasScore = (row: Row): boolean => num(row, "inspection_score") !== null;

const spec: DatasetSpec = {
  endpoint: ENDPOINT,
  source: "DataSF · Restaurant Scores (LIVES)",
  datasetUrl:
    "https://data.sfgov.org/Health-and-Social-Services/Restaurant-Scores-LIVES-Standard/pyih-qa8i",
  idField: "business_id",
  nameField: "business_name",
  latField: "business_latitude",
  lngField: "business_longitude",
  locField: "business_location",
  dateField: "inspection_date",
  extraGroupFields: ["business_address"],

  project(rows) {
    const chosen = reportedInspection(rows, "inspection_date", hasScore);
    if (!chosen) {
      return { grade: null, score: null, inspected_at: null, critical_violations: [] };
    }

    const scoreRow = chosen.rows.find(hasScore);
    const criticals = chosen.rows
      .filter((r) => str(r, "risk_category").toLowerCase().includes("high risk"))
      .map((r) => {
        const raw = str(r, "violation_description").trim();
        const known = HIGH_RISK[raw.toLowerCase()];
        if (known) return known;
        // Unknown phrasing: strip the risk prefix and any trailing code, then clip.
        const cleaned = raw
          .replace(/^\s*(?:high|moderate|low)\s+risk\s+/i, "")
          .replace(/\s*[-–]\s*\d+\s*$/, "");
        return { text: tidySummary(cleaned), severity: 4 };
      });

    return {
      grade: null, // LIVES has no letter grade in SF — only the numeric score.
      score: scoreRow ? num(scoreRow, "inspection_score") : null,
      inspected_at: chosen.date,
      critical_violations: topCriticals(criticals),
    };
  },
};

export async function lookup(args: HealthLookupArgs): Promise<Health> {
  return runLookup(spec, args);
}
