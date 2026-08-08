/**
 * Pure state machine for the swarm. Every agent talks to the UI exclusively
 * through SwarmEvents, so this file is the only place swarm state is shaped.
 *
 * Invariants:
 *  - never mutates its input
 *  - an unknown event returns the same state object
 *  - evidence is newest-first and capped so React never re-renders a huge list
 */

import type {
  AgentId,
  AgentState,
  ParsedReview,
  SwarmEvent,
  SwarmState,
} from "../types";

const AGENT_IDS: readonly AgentId[] = [
  "reviews",
  "press",
  "pulse",
  "social",
  "menu",
  "inspector",
  "context",
] as const;

const LABELS: Record<AgentId, string> = {
  reviews: "REVIEWS",
  press: "PRESS",
  pulse: "PULSE",
  social: "SOCIAL",
  menu: "MENU",
  inspector: "INSPECTOR",
  context: "CONTEXT",
};

/** Rendering budget — the evidence rail only ever shows a window anyway. */
const MAX_EVIDENCE = 120;
/** Each agent card shows a 3-line rolling transcript. */
const MAX_LOG = 3;
/** Two reviews are "the same" if their first 60 normalised chars match. */
const REVIEW_KEY_CHARS = 60;

function seedAgent(id: AgentId): AgentState {
  return {
    id,
    label: LABELS[id],
    status: "idle",
    statusLine: "",
    log: [],
    domains: [],
    count: 0,
  };
}

export function initialState(restaurant: string, city: string): SwarmState {
  const agents = {} as Record<AgentId, AgentState>;
  for (const id of AGENT_IDS) agents[id] = seedAgent(id);
  return {
    phase: "start",
    restaurant,
    city,
    agents,
    evidence: [],
    reviews: [],
    findings: {},
    social: null,
    contextStats: [],
    narration: "",
    analysis: null,
    error: null,
    startedAt: Date.now(),
  };
}

function patchAgent(
  state: SwarmState,
  id: AgentId,
  patch: Partial<AgentState>,
): SwarmState {
  const current = state.agents[id];
  if (!current) return state;
  return {
    ...state,
    agents: { ...state.agents, [id]: { ...current, ...patch } },
  };
}

function reviewKey(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, REVIEW_KEY_CHARS);
}

/** Merge new reviews into existing ones, dropping near-duplicates. */
function mergeReviews(
  existing: ParsedReview[],
  incoming: ParsedReview[],
): ParsedReview[] {
  const seen = new Set(existing.map((r) => reviewKey(r.text)));
  const merged = [...existing];
  for (const r of incoming) {
    const key = reviewKey(r.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(r);
  }
  return merged;
}

export function reducer(state: SwarmState, event: SwarmEvent): SwarmState {
  switch (event.type) {
    case "swarm/start":
      // A fresh run wipes evidence but keeps whatever phase the shell is in.
      return { ...initialState(event.restaurant, event.city), phase: state.phase };

    case "agent/status": {
      const current = state.agents[event.id];
      if (!current) return state;
      return patchAgent(state, event.id, {
        status: event.status,
        statusLine: event.line,
        log: [...current.log, { t: event.t, text: event.line }].slice(-MAX_LOG),
      });
    }

    case "agent/domain": {
      const current = state.agents[event.id];
      if (!current) return state;
      if (!event.domain || current.domains.includes(event.domain)) return state;
      return patchAgent(state, event.id, {
        domains: [...current.domains, event.domain],
      });
    }

    case "agent/evidence": {
      if (!event.items.length) return state;
      return {
        ...state,
        evidence: [...event.items, ...state.evidence].slice(0, MAX_EVIDENCE),
      };
    }

    case "agent/done":
      return patchAgent(state, event.id, { status: "done", count: event.count });

    case "agent/failed":
      return patchAgent(state, event.id, { status: "failed", error: event.error });

    case "reviews/collected":
      return { ...state, reviews: mergeReviews(state.reviews, event.reviews) };

    case "findings/collected":
      return {
        ...state,
        findings: { ...state.findings, [event.agent]: event.findings },
      };

    case "social/collected":
      return { ...state, social: event.pulse };

    case "context/collected":
      return { ...state, contextStats: event.stats };

    case "synthesis/start":
      return { ...state, narration: "", analysis: null, error: null };

    case "synthesis/token":
      return { ...state, narration: state.narration + event.text };

    case "synthesis/done":
      return { ...state, analysis: event.analysis };

    case "synthesis/failed":
      return { ...state, error: event.error };

    case "phase":
      return { ...state, phase: event.phase };

    default:
      return state;
  }
}
