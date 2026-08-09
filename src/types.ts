// ---------- Evidence ----------

export interface ParsedReview {
  date: string | null; // ISO YYYY-MM-DD
  stars: number | null; // 1-5
  text: string;
  source: string; // domain, or "pasted"
  url?: string;
}

export interface Finding {
  finding: string;
  quote: string | null;
  source: string;
  url?: string;
  date: string | null;
}

export interface SocialMention {
  platform: string;
  gist: string;
  quote: string | null;
  dish_or_topic: string | null;
  url?: string;
}

export type BuzzLevel = "quiet" | "steady" | "buzzing" | "viral";

export interface SocialPulse {
  buzz_level: BuzzLevel;
  driving_it: string;
  mentions: SocialMention[];
}

export interface ContextStat {
  stat: string;
  source: string;
}

// ---------- Swarm ----------

export type AgentId =
  | "reviews"
  | "press"
  | "pulse"
  | "social"
  | "menu"
  | "inspector"
  | "context";

export type AgentStatus =
  | "idle"
  | "spawned"
  | "searching"
  | "reading"
  | "extracting"
  | "done"
  | "failed";

export interface AgentLogLine {
  t: number; // ms since swarm start
  text: string;
}

export interface AgentState {
  id: AgentId;
  label: string;
  status: AgentStatus;
  statusLine: string;
  log: AgentLogLine[];
  domains: string[];
  count: number; // findings/reviews contributed
  error?: string;
}

export interface EvidenceItem {
  id: string;
  kind: "review" | "finding" | "social";
  text: string;
  source: string;
  stars?: number | null;
  date?: string | null;
  agent: AgentId;
}

export type SwarmEvent =
  | { type: "swarm/start"; restaurant: string; city: string }
  | { type: "agent/status"; id: AgentId; status: AgentStatus; line: string; t: number }
  | { type: "agent/domain"; id: AgentId; domain: string }
  | { type: "agent/evidence"; id: AgentId; items: EvidenceItem[] }
  | { type: "agent/done"; id: AgentId; count: number; t: number }
  | { type: "agent/failed"; id: AgentId; error: string; t: number }
  | { type: "reviews/collected"; reviews: ParsedReview[] }
  | { type: "findings/collected"; agent: AgentId; findings: Finding[] }
  | { type: "social/collected"; pulse: SocialPulse }
  | { type: "context/collected"; stats: ContextStat[] }
  | { type: "images/collected"; urls: string[] }
  | { type: "synthesis/start" }
  | { type: "synthesis/token"; text: string }
  | { type: "synthesis/done"; analysis: Analysis }
  | { type: "synthesis/failed"; error: string }
  | { type: "phase"; phase: Phase };

export type Phase = "start" | "engine" | "brief";

export interface SwarmState {
  phase: Phase;
  restaurant: string;
  city: string;
  agents: Record<AgentId, AgentState>;
  evidence: EvidenceItem[];
  reviews: ParsedReview[];
  findings: Record<string, Finding[]>;
  social: SocialPulse | null;
  contextStats: ContextStat[];
  images: string[];
  narration: string;
  analysis: Analysis | null;
  error: string | null;
  startedAt: number;
}

// ---------- Analysis ----------

export type PatternCategory =
  | "service"
  | "food"
  | "pacing"
  | "pricing"
  | "staffing"
  | "ambience"
  | "consistency";

export type PatternTrend = "improving" | "worsening" | "stable" | "new";

export interface Pattern {
  title: string;
  category: PatternCategory;
  frequency: string;
  trend: PatternTrend;
  excerpts: string[];
  sources: string[];
}

export interface KeyReview {
  quote: string;
  stars: number | null;
  date: string | null;
  source: string;
  why_chosen: "most_representative" | "most_alarming" | "most_promising";
}

/** Award/recognition chip. Only ever built from an explicit finding. */
export interface Badge {
  label: string;
  domain: string;
  year: string | null;
}

/** Every field is null when the evidence doesn't support it; chips hide. */
export interface Vitals {
  price_tier: string | null;
  booking_difficulty: "walk-in" | "plan-ahead" | "hard" | "lottery" | null;
  busiest: string | null;
  best_time_to_try: string | null;
  reservation_route: string | null;
}

/** The second render of the same corpus — see DinerView in Brief.tsx. */
export interface DinerView {
  should_you_go: string;
  order_this: string[];
  skip_this: string[];
  getting_in: string;
  know_before: string[];
  go_when: string | null;
}

export interface Analysis {
  verdict: string;
  badges: Badge[];
  vitals: Vitals | null;
  patterns: Pattern[];
  delta: string;
  corroboration: string;
  one_fix: { action: string; why_this_one: string; evidence: string[] };
  bright_spots: { finding: string; excerpts: string[] }[];
  key_reviews: KeyReview[];
  diner_view: DinerView | null;
}

/** What the natural-language resolver returns for a typed query. */
export interface Resolved {
  name_guess: string;
  city_guess: string | null;
  confidence: "high" | "medium" | "low";
  corrected_from: string | null;
}

export interface Reply {
  review_excerpt: string;
  reply: string;
}
