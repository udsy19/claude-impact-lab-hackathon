import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Decide from "./views/Decide";
import Results, { Thinking } from "./views/Results";
import DossierView from "./views/DossierView";
import SharePage from "./views/SharePage";
import ClaimPage from "./views/ClaimPage";
import { db } from "./db";
import { deviceId } from "./lib/location";
import { findCandidates } from "./decision/candidates";
import { rank, resolveFreeText } from "./decision/rank";
import type { Candidate, Constraints, Place, Suggestion } from "./decision/types";
import type { Restaurant } from "./db/types";

type Route =
  | { name: "decide" }
  | { name: "results" }
  | { name: "dossier"; restaurant: Restaurant }
  | { name: "share"; slug: string }
  | { name: "claim"; slug: string };

function parseRoute(): Route {
  const p = window.location.pathname;
  const share = /^\/r\/([\w-]+)/.exec(p);
  if (share) return { name: "share", slug: share[1] };
  const claim = /^\/claim\/([\w-]+)/.exec(p);
  if (claim) return { name: "claim", slug: claim[1] };
  return { name: "decide" };
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute);
  const [busy, setBusy] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [constraints, setConstraints] = useState<Constraints | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [logId, setLogId] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = useCallback((r: Route, path?: string) => {
    setRoute(r);
    if (path) window.history.pushState({}, "", path);
    window.scrollTo(0, 0);
  }, []);

  const search = useCallback(
    async (c: Constraints, p: Place, skip: string[] = []) => {
      abort.current?.abort();
      abort.current = new AbortController();
      const signal = abort.current.signal;
      setBusy(true);
      setConstraints(c);
      setPlace(p);

      try {
        // "another"/free-text becomes concrete tags before we go looking.
        const withTags: Constraints = c.freeText
          ? { ...c, extraTags: await resolveFreeText(c.freeText, signal) }
          : c;

        const found = await findCandidates(p, withTags, signal);
        const pool = skip.length
          ? found.filter((x) => !skip.includes(x.restaurant.id))
          : found;
        setCandidates(pool);

        const picks = await rank(
          pool,
          withTags,
          p.neighborhood ?? p.city ?? "here",
          signal,
        );
        setSuggestions(picks);
        go({ name: "results" });

        // The personalization asset. Log every session, chosen or not.
        const id = await db.logDecision({
          device_id: deviceId(),
          constraints: withTags as unknown,
          shown: picks as unknown,
          chosen: null,
        });
        setLogId(id);
      } finally {
        setBusy(false);
      }
    },
    [go],
  );

  const openDossier = useCallback(
    (c: Candidate) => {
      if (logId) void db.markChosen(logId, c.restaurant.id);
      go({ name: "dossier", restaurant: c.restaurant });
    },
    [logId, go],
  );

  /**
   * Candidates are snapshotted at search time, so a dossier built during this
   * session left the card still reading "run the check". Re-read the cache on
   * the way back — it is a local lookup, not a network call.
   */
  const backToResults = useCallback(() => {
    go({ name: suggestions.length ? "results" : "decide" });
    if (!candidates.length) return;
    void (async () => {
      const map = await db.dossiersFor(candidates.map((c) => c.restaurant.id));
      setCandidates((prev) =>
        prev.map((c) => {
          const d = map[c.restaurant.id];
          if (!d || !d.verdict) return c;
          const health = d.health;
          const dv = d.diner_view as { order_this?: string[] } | null;
          return {
            ...c,
            hasDossier: d.status !== "failed",
            verdict: d.verdict,
            badges: (d.badges as { label: string }[]) ?? [],
            healthGrade: health?.status === "matched" ? health.grade : null,
            healthScore: health?.status === "matched" ? health.score : null,
            healthCritical:
              health?.status === "matched" && health.critical_violations.length > 0,
            topDish: dv?.order_this?.[0] ?? c.topDish,
          };
        }),
      );
    })();
  }, [go, suggestions.length, candidates]);

  const reroll = useCallback(() => {
    if (!constraints || !place) return;
    const skip = [...excluded, ...suggestions.map((s) => s.restaurant_id)];
    setExcluded(skip);
    void search(constraints, place, skip);
  }, [constraints, place, suggestions, excluded, search]);

  // ---- public routes render standalone ----
  if (route.name === "share") {
    return <Shell><SharePage slug={route.slug} /></Shell>;
  }
  if (route.name === "claim") {
    return <Shell><ClaimPage slug={route.slug} /></Shell>;
  }

  return (
    <Shell>
      <AnimatePresence mode="wait">
        {busy ? (
          <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Thinking />
          </motion.div>
        ) : route.name === "decide" ? (
          <motion.div key="decide" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Decide onDone={(c, p) => void search(c, p)} />
          </motion.div>
        ) : route.name === "results" && constraints && place ? (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <TopBar onBack={() => go({ name: "decide" })} label="start over" />
            <Results
              suggestions={suggestions}
              candidates={candidates}
              constraints={constraints}
              place={place}
              onOpen={openDossier}
              onShare={openDossier}
              onReroll={reroll}
              rerolling={busy}
            />
          </motion.div>
        ) : route.name === "dossier" ? (
          <motion.div key="dossier" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <TopBar
              onBack={backToResults}
              label="back"
            />
            <DossierView restaurant={route.restaurant} />
          </motion.div>
        ) : (
          <motion.div key="fallback" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Decide onDone={(c, p) => void search(c, p)} />
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}

function TopBar({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-1.5 border-b border-rule bg-white/95 px-4 py-2.5 backdrop-blur">
      <button
        onClick={onBack}
        className="flex items-center gap-1 font-sans text-[0.8rem] text-muted"
      >
        <ArrowLeft size={14} />
        {label}
      </button>
    </div>
  );
}

/** The product is a phone. Desktop just centers it. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-full w-full max-w-[430px] bg-white shadow-[0_0_60px_rgba(0,0,0,0.06)] print:max-w-none print:shadow-none">
      {children}
    </div>
  );
}
