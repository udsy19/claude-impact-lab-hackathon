/**
 * Orchestrator. Fans the agents out in parallel, holds a hard wall-clock
 * budget, and hands back control. It deliberately does NOT synthesise —
 * App.tsx owns the streamed brief so the narration can render as it arrives.
 */

import {
  contextAgent,
  inspectorAgent,
  menuAgent,
  photoTopUp,
  pressAgent,
  pulseAgent,
  reviewsAgent,
  socialAgent,
  type AgentCtx,
} from "./agents";
import type { SwarmEvent, SwarmState } from "../types";

/** Hard ceiling on the research phase. Whatever has landed by now is the brief. */
const SWARM_TIMEOUT_MS = 75_000;

/** Synthesis budget guards. */
const MAX_SYNTHESIS_REVIEWS = 120;
const REVIEW_TEXT_CHARS = 600;
const MAX_SYNTHESIS_FINDINGS = 40;

export async function runSwarm(opts: {
  name: string;
  city: string;
  dispatch: (e: SwarmEvent) => void;
  signal?: AbortSignal;
  tier2?: boolean; // default false — menu/inspector/context
}): Promise<void> {
  const { name, city, dispatch, signal, tier2 = false } = opts;

  const start = Date.now();
  const t = () => Date.now() - start;

  // One internal controller drives every fetch. It aborts on the global
  // timeout OR when the caller aborts; agents already surface partial results.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SWARM_TIMEOUT_MS);

  const onCallerAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onCallerAbort, { once: true });
  }

  dispatch({ type: "swarm/start", restaurant: name, city });

  // runSwarm holds no state, so it taps its own dispatch to know whether the
  // main sweep produced any photos before deciding to spend a top-up probe.
  let imageCount = 0;
  const tap = (e: SwarmEvent) => {
    if (e.type === "images/collected") imageCount += e.urls.length;
    dispatch(e);
  };

  const ctx: AgentCtx = { name, city, dispatch: tap, signal: controller.signal, t };

  const agents = [reviewsAgent, pressAgent, pulseAgent, socialAgent];
  if (tier2) agents.push(menuAgent, inspectorAgent, contextAgent);

  try {
    // allSettled, not all: agents already swallow their own errors, but this
    // guarantees a rejection from anywhere can never cancel a sibling.
    await Promise.allSettled(agents.map((agent) => agent(ctx)));
    // Still inside the 75s budget — the shared controller aborts it if we run out.
    if (imageCount === 0 && !controller.signal.aborted) await photoTopUp(ctx);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/**
 * Pack the collected state into the string slices SYNTHESIZE_PROMPT expects,
 * trimmed so a 300-review restaurant still fits the context window.
 */
export function synthesisInput(state: SwarmState): {
  name: string;
  city: string;
  reviews: string;
  press: string;
  pulse: string;
  social: string;
  menu: string;
} {
  const reviews = state.reviews.slice(0, MAX_SYNTHESIS_REVIEWS).map((r) => ({
    date: r.date,
    stars: r.stars,
    source: r.source,
    text: clip(r.text, REVIEW_TEXT_CHARS),
  }));

  const slice = (key: string) =>
    (state.findings[key] ?? []).slice(0, MAX_SYNTHESIS_FINDINGS);

  return {
    name: state.restaurant,
    city: state.city,
    reviews: JSON.stringify(reviews),
    press: JSON.stringify(slice("press")),
    pulse: JSON.stringify(slice("pulse")),
    social: JSON.stringify(state.social ?? { buzz_level: "quiet", mentions: [] }),
    // The prompt has one slot for "menu and prices"; inspection findings ride
    // along rather than being collected and then dropped on the floor.
    menu: JSON.stringify([...slice("menu"), ...slice("inspector")]),
  };
}
