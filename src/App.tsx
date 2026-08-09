import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Check, MapPin, Search } from "lucide-react";
import Engine from "./views/Engine";
import Brief from "./views/Brief";
import PasteDrawer from "./components/PasteDrawer";
import AskDrawer from "./components/AskDrawer";
import { initialState, reducer } from "./swarm/reducer";
import { runSwarm, synthesisInput } from "./swarm/runSwarm";
import { completeJSON, completeStream, parseJSON } from "./api/claude";
import { REPLIES_PROMPT, RESOLVE_PROMPT, SYNTHESIZE_PROMPT } from "./prompts";
import {
  DEMO_ANALYSIS,
  DEMO_CITY,
  DEMO_EVENTS,
  DEMO_IMAGES,
  DEMO_NARRATION,
  DEMO_REPLIES,
  DEMO_RESTAURANT,
  DEMO_REVIEWS,
} from "./fixtures/sample_swarm";
import type { Analysis, ParsedReview, Reply, Resolved } from "./types";

const isDemoURL = new URLSearchParams(window.location.search).has("demo");
const DEFAULT_CITY = "Palo Alto";

function recentNegatives(reviews: ParsedReview[]): ParsedReview[] {
  const negs = reviews.filter((r) => r.stars === null || r.stars <= 3);
  const pool = negs.length ? negs : reviews;
  return [...pool]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 3);
}

function titlesSoFar(stream: string): string[] {
  const out: string[] = [];
  const re = /"title"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stream))) out.push(m[1]);
  return out;
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState("", ""));
  const [query, setQuery] = useState("");
  const [city, setCity] = useState(DEFAULT_CITY);
  const [editingCity, setEditingCity] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [repliesError, setRepliesError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const started = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const draftReplies = useCallback(
    async (reviews: ParsedReview[], restaurant: string) => {
      setRepliesError(null);
      setReplies(null);
      try {
        setReplies(
          await completeJSON<Reply[]>(
            REPLIES_PROMPT(JSON.stringify(recentNegatives(reviews)), restaurant),
            2000,
          ),
        );
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
        particleCount: 80,
        spread: 64,
        origin: { y: 0.3 },
        colors: ["#9c3b23", "#d2603f", "#ddd6cc"],
        disableForReducedMotion: true,
      });
    }, 240);
  }, []);

  /**
   * `reviewsOverride` exists because stateRef only catches up after React
   * flushes. The paste path dispatches and synthesizes in the same tick, and
   * without it the prompt got zero reviews while the header said 46.
   */
  const synthesize = useCallback(
    async (
      restaurant: string,
      signal?: AbortSignal,
      reviewsOverride?: ParsedReview[],
    ) => {
      const base = stateRef.current;
      const st = reviewsOverride?.length
        ? { ...base, reviews: reviewsOverride }
        : base;
      dispatch({ type: "synthesis/start" });
      try {
        const raw = await completeStream(
          SYNTHESIZE_PROMPT(synthesisInput(st)),
          (t) => dispatch({ type: "synthesis/token", text: t }),
          8000,
          signal,
        );
        dispatch({ type: "synthesis/done", analysis: parseJSON<Analysis>(raw) });
        void draftReplies(st.reviews, restaurant);
        reveal();
      } catch (e) {
        dispatch({
          type: "synthesis/failed",
          error: e instanceof Error ? e.message : "Synthesis failed.",
        });
      }
    },
    [draftReplies, reveal],
  );

  const runDemo = useCallback(() => {
    dispatch({ type: "swarm/start", restaurant: DEMO_RESTAURANT, city: DEMO_CITY });
    dispatch({ type: "phase", phase: "engine" });
    setCity(DEMO_CITY);
    setResolved(null);

    for (const { at, event } of DEMO_EVENTS) setTimeout(() => dispatch(event), at);
    const last = DEMO_EVENTS.length ? Math.max(...DEMO_EVENTS.map((e) => e.at)) : 0;

    const startAt = last + 400;
    const chunks = DEMO_NARRATION.match(/.{1,3}/gs) ?? [];
    chunks.forEach((c, i) =>
      setTimeout(() => dispatch({ type: "synthesis/token", text: c }), startAt + i * 14),
    );
    setTimeout(
      () => {
        if (DEMO_IMAGES.length) {
          dispatch({ type: "images/collected", urls: DEMO_IMAGES });
        }
        dispatch({ type: "synthesis/done", analysis: DEMO_ANALYSIS });
        setReplies(DEMO_REPLIES);
        reveal();
      },
      startAt + chunks.length * 14 + 900,
    );
  }, [reveal]);

  const launch = useCallback(
    async (name: string, town: string) => {
      abort.current?.abort();
      abort.current = new AbortController();
      dispatch({ type: "swarm/start", restaurant: name, city: town });
      dispatch({ type: "phase", phase: "engine" });
      await runSwarm({
        name,
        city: town,
        dispatch,
        signal: abort.current.signal,
        tier2: true,
      });
      await synthesize(name, abort.current.signal);
    },
    [synthesize],
  );

  /** One fast call turns "da pio zer in mountain view" into a real restaurant. */
  const resolve = useCallback(async () => {
    const q = query.trim();
    if (!q || resolving) return;
    setResolveError(null);
    setResolving(true);
    try {
      const r = await completeJSON<Resolved>(RESOLVE_PROMPT(q, city), 400);
      const town = r.city_guess?.trim() || city;
      setResolved(r);
      if (r.city_guess) setCity(town);
      // Low confidence waits for a human; anything else proceeds on its own.
      if (r.confidence !== "low") {
        setTimeout(() => void launch(r.name_guess, town), 1500);
      }
    } catch (e) {
      setResolveError(
        e instanceof Error ? e.message : "Could not work out which place that is.",
      );
    } finally {
      setResolving(false);
    }
  }, [query, city, resolving, launch]);

  const onPasted = useCallback(
    (reviews: ParsedReview[]) => {
      dispatch({ type: "reviews/collected", reviews });
      if (stateRef.current.phase !== "start") return;

      const restaurant = resolved?.name_guess || query.trim() || "Your restaurant";
      abort.current?.abort();
      abort.current = new AbortController();
      dispatch({ type: "swarm/start", restaurant, city });
      dispatch({ type: "phase", phase: "engine" });
      dispatch({ type: "reviews/collected", reviews });
      dispatch({
        type: "agent/status",
        id: "reviews",
        status: "done",
        line: `${reviews.length} reviews pasted by the owner`,
        t: 0,
      });
      dispatch({ type: "agent/done", id: "reviews", count: reviews.length, t: 0 });
      dispatch({
        type: "agent/evidence",
        id: "reviews",
        items: reviews.slice(0, 40).map((r, i) => ({
          id: `paste-${i}`,
          kind: "review" as const,
          text: r.text,
          source: r.source || "pasted",
          stars: r.stars,
          date: r.date,
          agent: "reviews" as const,
        })),
      });
      void synthesize(restaurant, abort.current.signal, reviews);
    },
    [query, city, resolved, synthesize],
  );

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
  const askEvidence = JSON.stringify({
    reviews: state.reviews.slice(0, 60).map((r) => ({
      text: r.text.slice(0, 400),
      source: r.source,
      stars: r.stars,
      date: r.date,
    })),
    findings: state.findings,
    social: state.social,
  });

  return (
    /* The product is a phone. Desktop just frames it. */
    <div className="mx-auto min-h-full w-full max-w-[430px] bg-white shadow-[0_0_60px_rgba(0,0,0,0.07)] print:max-w-none print:shadow-none">
      <PasteDrawer
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onParsed={onPasted}
      />
      {state.analysis && (
        <AskDrawer
          open={askOpen}
          onClose={() => setAskOpen(false)}
          restaurant={state.restaurant}
          evidence={askEvidence}
          brief={JSON.stringify(state.analysis)}
        />
      )}

      {state.phase === "start" && (
        <div className="px-6 py-16">
          <h1 className="font-serif text-5xl leading-none tracking-tight text-accent">
            Tablestakes
          </h1>
          <p className="mt-4 font-serif text-lg leading-snug">
            Every restaurant has a consultant working for free — their customers.
            This is the tool that reads the report.
          </p>

          {/* Location chip */}
          <div className="mt-8 flex items-center gap-1.5 text-[0.75rem] text-muted">
            <MapPin size={12} />
            {editingCity ? (
              <input
                autoFocus
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onBlur={() => setEditingCity(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingCity(false)}
                className="w-32 border-b border-rule bg-transparent outline-none focus:border-accent"
              />
            ) : (
              <button
                onClick={() => setEditingCity(true)}
                className="underline decoration-dotted underline-offset-4"
              >
                {city}
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2 border border-rule bg-white px-3 py-3 focus-within:border-accent">
            <Search size={16} className="shrink-0 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void resolve()}
              placeholder="da pio zer in mountain view"
              className="w-full bg-transparent font-sans text-base outline-none placeholder:text-muted/60"
            />
          </div>

          <button
            onClick={() => void resolve()}
            disabled={!query.trim() || resolving || !!resolved}
            className="mt-3 w-full bg-accent py-3 font-sans font-medium text-white disabled:opacity-40"
          >
            {resolving ? "Working out which place…" : "Tell me the place"}
          </button>

          {resolved && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <Check size={14} className="text-accent" />
                <span className="font-serif text-base font-semibold">
                  {resolved.name_guess}
                </span>
                <span className="text-sm text-muted">· {city}</span>
              </div>
              {resolved.corrected_from && (
                <p className="mt-1 font-sans text-[0.7rem] text-muted">
                  corrected from “{resolved.corrected_from}”
                </p>
              )}
              {resolved.confidence === "low" ? (
                <button
                  onClick={() => void launch(resolved.name_guess, city)}
                  className="mt-2 font-sans text-[0.75rem] text-accent underline underline-offset-4"
                >
                  Not sure that's right — research it anyway
                </button>
              ) : (
                <p className="mt-1 font-sans text-[0.7rem] text-muted">
                  Researching…
                </p>
              )}
            </motion.div>
          )}

          {resolveError && (
            <div className="mt-4 border border-accent/40 bg-accent-soft/50 p-3">
              <p className="font-sans text-[0.8rem]">{resolveError}</p>
              <button
                onClick={() => void resolve()}
                className="mt-1 font-sans text-[0.8rem] text-accent underline underline-offset-4"
              >
                Try again
              </button>
            </div>
          )}

          <p className="mt-8 font-sans text-[0.8rem] text-muted">
            Seven research agents fan out across reviews, press, news and social —
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
            <div className="space-y-1.5 bg-[#0b0d0f] px-4 pb-8">
              {liveTitles.map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded border border-[#3a2a22] bg-[#171b21] px-3 py-2 font-mono text-[0.7rem] text-[#e0a68f]"
                >
                  pattern · {t}
                </motion.div>
              ))}
            </div>
          )}
          {state.error && (
            <div className="bg-[#0b0d0f] px-4 pb-10">
              <div className="rounded border border-[#7a5a1f] bg-[#1c1710] p-3">
                <p className="font-mono text-[0.75rem] text-[#d99a3f]">
                  {state.error}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {state.phase === "brief" && state.analysis && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Brief
            restaurant={state.restaurant}
            city={state.city}
            analysis={state.analysis}
            reviews={state.reviews.length ? state.reviews : DEMO_REVIEWS}
            findings={state.findings}
            social={state.social}
            contextStats={state.contextStats}
            images={state.images}
            replies={replies}
            repliesError={repliesError}
            onRetryReplies={() =>
              void draftReplies(state.reviews, state.restaurant)
            }
            onAsk={() => setAskOpen(true)}
          />
        </motion.div>
      )}
    </div>
  );
}
