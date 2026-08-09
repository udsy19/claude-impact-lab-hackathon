/**
 * New York City adapter — NYC Open Data "DOHMH Restaurant Inspection Results".
 *
 * Verified against the live endpoint: one row per violation, `location` is a
 * real Socrata point column (so `within_circle` works), `inspection_date` is
 * 1900-01-01 for never-inspected establishments, and a freshly inspected
 * restaurant often has a score but no letter grade yet (grade is issued after
 * the re-inspection window). In that case `grade` is null rather than stale.
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

const ENDPOINT = "https://data.cityofnewyork.us/resource/43nn-pn8j.json";

/** Only real letter grades reach the UI; N / Z / P mean "not graded yet". */
const LETTER_GRADES = new Set(["A", "B", "C"]);

/**
 * Plain-language summaries keyed by DOHMH violation code. Codes were pulled
 * live (`$group=violation_code` over `critical_flag='Critical'`) and each
 * summary was written against that code's actual description text.
 * Severity: 1 pests/contamination, 2 temperature, 3 hygiene, 4 clerical.
 */
const CRITICAL_CODES: Record<string, { text: string; severity: number }> = {
  "04K": { text: "Evidence of rats or live rats on site", severity: 1 },
  "04L": { text: "Evidence of mice or live mice on site", severity: 1 },
  "04M": { text: "Live roaches in the facility", severity: 1 },
  "04N": { text: "Filth flies or other nuisance pests present", severity: 1 },
  "04O": { text: "Live animal in a food or non-food area", severity: 1 },
  "04F": { text: "Food area contaminated by sewage or liquid waste", severity: 1 },
  "05A": { text: "Sewage disposal improper or inadequate", severity: 1 },
  "04H": { text: "Food contaminated, adulterated or cross-contaminated", severity: 1 },
  "04P": { text: "Prohibited substance found in food", severity: 1 },
  "03A": { text: "Food from an unapproved or unknown source", severity: 1 },
  "03B": { text: "Shellfish untagged or from an unapproved source", severity: 1 },
  "03C": { text: "Unclean or cracked eggs kept or used", severity: 1 },
  "03E": { text: "Water supply unsafe, inadequate or unapproved", severity: 1 },
  "09A": { text: "Damaged canned food not separated or labelled", severity: 1 },
  "04E": { text: "Toxic chemicals or pesticides stored unsafely", severity: 1 },
  "05B": { text: "Harmful gas or high carbon monoxide detected", severity: 1 },
  "02A": { text: "Food not cooked to a safe internal temperature", severity: 2 },
  "02B": { text: "Hot food held below 140°F", severity: 2 },
  "02C": { text: "Cooked food not reheated to a safe temperature", severity: 2 },
  "02F": { text: "Raw or undercooked items served without written notice", severity: 2 },
  "02G": { text: "Cold food held above 41°F", severity: 2 },
  "02H": { text: "Cooked food not cooled down fast enough", severity: 2 },
  "02I": { text: "Prepared food not cooled within four hours", severity: 2 },
  "05F": { text: "Not enough hot-holding or refrigeration equipment", severity: 2 },
  "06C": { text: "Food or equipment not protected from contamination", severity: 2 },
  "06D": { text: "Food-contact surfaces not washed and sanitised after use", severity: 2 },
  "04C": { text: "Bare-hand contact with ready-to-eat food", severity: 3 },
  "04D": { text: "Food workers not washing hands properly", severity: 3 },
  "05D": { text: "Handwashing sink missing, blocked or misused", severity: 3 },
  "05C": { text: "Food-contact equipment poorly built or maintained", severity: 3 },
  "06A": { text: "Poor personal cleanliness among food workers", severity: 3 },
  "06B": { text: "Eating, drinking or tobacco use in food areas", severity: 3 },
  "06E": { text: "Sanitised utensils used or stored improperly", severity: 3 },
  "06F": { text: "Wiping cloths not kept clean or in sanitiser", severity: 3 },
  "05E": { text: "Required toilet facility not provided", severity: 3 },
  "04A": { text: "No certified food protection manager on duty", severity: 4 },
  "04J": { text: "No accessible thermometer to check food temperatures", severity: 4 },
  "05H": { text: "No written procedure for reusable customer containers", severity: 4 },
  "06G": { text: "HACCP plan missing or not approved", severity: 4 },
  "03I": { text: "Juice packaged without the required labelling", severity: 4 },
};

const hasScore = (row: Row): boolean => num(row, "score") !== null;

const spec: DatasetSpec = {
  endpoint: ENDPOINT,
  source: "NYC Open Data · DOHMH Restaurant Inspections",
  datasetUrl:
    "https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j",
  idField: "camis",
  nameField: "dba",
  latField: "latitude",
  lngField: "longitude",
  locField: "location",
  dateField: "inspection_date",
  extraGroupFields: ["boro", "building", "street"],

  project(rows) {
    const chosen = reportedInspection(rows, "inspection_date", hasScore);
    if (!chosen) {
      return { grade: null, score: null, inspected_at: null, critical_violations: [] };
    }

    const scoreRow = chosen.rows.find(hasScore);
    const gradeRow = chosen.rows.find((r) => LETTER_GRADES.has(str(r, "grade").toUpperCase()));

    const criticals = chosen.rows
      .filter((r) => str(r, "critical_flag") === "Critical")
      .map((r) => {
        const code = str(r, "violation_code").toUpperCase();
        const known = CRITICAL_CODES[code];
        if (known) return known;
        // Unknown code: take the first clause, drop the code and the legalese
        // tail, then clip to 12 words.
        const cleaned = str(r, "violation_description")
          .replace(/^\s*\d{2}[A-Z]\.?\s*/i, "")
          .split(/(?<=[a-z0-9])\.\s|•/)[0]
          .replace(/\s*\([^)]*\)/g, "");
        return { text: tidySummary(cleaned), severity: 3 };
      });

    return {
      grade: gradeRow ? str(gradeRow, "grade").toUpperCase() : null,
      score: scoreRow ? num(scoreRow, "score") : null,
      inspected_at: chosen.date,
      critical_violations: topCriticals(criticals),
    };
  },
};

export async function lookup(args: HealthLookupArgs): Promise<Health> {
  return runLookup(spec, args);
}
