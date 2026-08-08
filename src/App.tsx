import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import Engine from "./views/Engine";
import Brief from "./views/Brief";
import PasteDrawer from "./components/PasteDrawer";
import { initialState, reducer } from "./swarm/reducer";
import { runSwarm, synthesisInput } from "./swarm/runSwarm";
import { completeJSON, completeStream, parseJSON } from "./api/claude";
import { REPLIES_PROMPT, SYNTHESIZE_PROMPT } from "./prompts";
import {
  DEMO_ANALYSIS,
  DEMO_CITY,
  DEMO_EVENTS,
  DEMO_NARRATION,
  DEMO_REPLIES,
  DEMO_RESTAURANT,
  DEMO_REVIEWS,
} from "./fixtures/sample_swarm";
import type { Analysis, ParsedReview, Reply } from "./types";

const isDemoURL = new URLSearchParams(window.location.search).has("demo");

/** The 3 most recent reviews at 3 stars or below. */
function recentNegatives(reviews: ParsedReview[]): ParsedReview[] {
  const negs = reviews.filter((r) => r.stars === null || r.stars <= 3);
  const pool = negs.length ? negs : reviews;
  return [...pool]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 3);
}

/** Pattern titles as they become visible in the partially-streamed JSON. */
function titlesSoFar(stream: string): string[] {
  const out: string[] = [];
  const re = /"title"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stream))) out.push(m[1]);
  return out;
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState("", ""));
  const [name, setName] = useState("");
  const [city, setCity] = useState("Palo Alto");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [repliesError, setRepliesError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const started = useRef(false);
  // Lets runLive read the latest reducer state without re-creating the callback.
  const stateRef = useRef(state);
  stateRef.current = state;

  const draftReplies = useCallback(
    async (reviews: ParsedReview[], restaurant: string) => {
      setRepliesError(null);
      setReplies(null);
      try {
        const out = await completeJSON<Reply[]>(
          REPLIES_PROMPT(JSON.stringify(recentNegatives(reviews)), restaurant),
          2000,
        );
        setReplies(out);
      } catch (e) {
        setRepliesError(e instanceof Error ? e.message : "Could not draft replies.");
      }
    },
    [],
  );

  const reveal = useCallback(() => {
    dispatch({ type: "phase", phase: "brief" });
    window.scrollTo(0, 0);
    setTimeout(() => {
      confetti({
        particleCount: 90,
        spread: 68,
        origin: { y: 0.28 },
        colors: ["#9c3b23", "#d2603f", "#ddd6cc"],
        disableForReducedMotion: true,
      });
    }, 260);
  }, []);

  /** Offline replay: schedule every captured event, then the narration. */
  const runDemo = useCallback(() => {
    dispatch({ type: "swarm/start", restaurant: DEMO_RESTAURANT, city: DEMO_CITY });
    dispatch({ type: "phase", phase: "engine" });
    setName(DEMO_RESTAURANT);
    setCity(DEMO_CITY);

    for (const { at, event } of DEMO_EVENTS) {
      setTimeout(() => dispatch(event), at);
    }
    const last = DEMO_EVENTS.length
      ? Math.max(...DEMO_EVENTS.map((e) => e.at))
      : 0;

    // Type the captured narration out at a readable pace.
    const startAt = last + 400;
    const chunks = DEMO_NARRATION.match(/.{1,3}/gs) ?? [];
    chunks.forEach((c, i) => {
      setTimeout(() => dispatch({ type: "synthesis/token", text: c }), startAt + i * 14);
    });
    const doneAt = startAt + chunks.length * 14 + 900;
    setTimeout(() => {
      dispatch({ type: "synthesis/done", analysis: DEMO_ANALYSIS });
      setReplies(DEMO_REPLIES);
      reveal();
    }, doneAt);
  }, [reveal]);

  const runLive = useCallback(async () => {
    const restaurant = name.trim();
    if (!restaurant) return;
    abort.current?.abort();
    abort.current = new AbortController();

    dispatch({ type: "swarm/start", restaurant, city: city.trim() });
    dispatch({ type: "phase", phase: "engine" });

    await runSwarm({
      name: restaurant,
      city: city.trim(),
      dispatch,
      signal: abort.current.signal,
      tier2: true,
    });

    dispatch({ type: "synthesis/start" });
    try {
      const raw = await completeStream(
        SYNTHESIZE_PROMPT(synthesisInput(stateRef.current)),
        (t) => dispatch({ type: "synthesis/token", text: t }),
        8000,
        abort.current.signal,
      );
      const analysis = parseJSON<Analysis>(raw);
      dispatch({ type: "synthesis/done", analysis });
      void draftReplies(stateRef.current.reviews, restaurant);
      reveal();
    } catch (e) {
      dispatch({
        type: "synthesis/failed",
        error: e instanceof Error ? e.message : "Synthesis failed.",
      });
    }
  }, [name, city, draftReplies, reveal]);

  // ?demo=1, or the hidden D hotkey on the start screen.
  useEffect(() => {
    if (isDemoURL && !started.current) {
      started.current = true;
      runDemo();
    }
  }, [runDemo]);

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (
        state.phase === "start" &&
        (ev.key === "d" || ev.key === "D") &&
        !(ev.target instanceof HTMLInputElement) &&
        !(ev.target instanceof HTMLTextAreaElement)
      ) {
        started.current = true;
        runDemo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.phase, runDemo]);

  const liveTitles = state.analysis ? [] : titlesSoFar(state.narration);

  return (
    <div className="min-h-full">
      <PasteDrawer
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onParsed={(reviews) => dispatch({ type: "reviews/collected", reviews })}
      />

      {state.phase === "start" && (
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h1 className="font-serif text-6xl tracking-tight text-accent">
            Tablestakes
          </h1>
          <p className="mt-5 max-w-xl font-serif text-xl leading-relaxed">
            Every restaurant has a consultant working for free — their customers.
            This is the tool that reads the report.
          </p>

          <div className="mt-12 flex flex-wrap gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void runLive()}
              placeholder="Restaurant name"
              className="min-w-[18rem] flex-1 border border-rule bg-white px-4 py-3 font-sans outline-none focus:border-accent"
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void runLive()}
              placeholder="City"
              className="w-40 border border-rule bg-white px-4 py-3 font-sans outline-none focus:border-accent"
            />
            <button
              onClick={() => void runLive()}
              disabled={!name.trim()}
              className="bg-accent px-7 py-3 font-sans text-base font-medium text-white disabled:opacity-40"
            >
              Research this restaurant
            </button>
          </div>

          <p className="mt-4 text-sm text-muted">
            Six research agents fan out across reviews, press, news and social —
            in parallel.{" "}
            <button
              onClick={() => setPasteOpen(true)}
              className="text-accent underline underline-offset-4"
            >
              Or paste reviews directly
            </button>
            .
          </p>
        </div>
      )}

      {state.phase === "engine" && (
        <>
          <Engine state={state} onOpenPaste={() => setPasteOpen(true)} />
          {liveTitles.length > 0 && (
            <div className="mx-auto max-w-[1400px] px-6 pb-10">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {liveTitles.map((t, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded border border-[#3a2a22] bg-[#171b21] px-3 py-2 font-mono text-[0.72rem] text-[#e0a68f]"
                  >
                    pattern · {t}
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          {state.error && (
            <div className="mx-auto max-w-[1400px] px-6 pb-12">
              <div className="rounded border border-[#7a5a1f] bg-[#1c1710] p-4">
                <p className="font-mono text-sm text-[#d99a3f]">{state.error}</p>
                <button
                  onClick={() => void runLive()}
                  className="mt-2 font-mono text-sm text-[#d99a3f] underline underline-offset-4"
                >
                  retry
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {state.phase === "brief" && state.analysis && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="py-10"
        >
          <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between px-2">
            <button
              onClick={() => dispatch({ type: "phase", phase: "engine" })}
              className="font-sans text-sm text-muted underline underline-offset-4"
            >
              ← Back to the swarm
            </button>
          </div>
          <Brief
            restaurant={state.restaurant || name}
            city={state.city || city}
            onNameChange={setName}
            analysis={state.analysis}
            reviews={state.reviews.length ? state.reviews : DEMO_REVIEWS}
            findings={state.findings}
            social={state.social}
            contextStats={state.contextStats}
            replies={replies}
            repliesError={repliesError}
            onRetryReplies={() =>
              void draftReplies(state.reviews, state.restaurant || name)
            }
          />
        </motion.div>
      )}
    </div>
  );
}
