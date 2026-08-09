import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, RefreshCw, Share2, ShieldCheck, ShieldAlert } from "lucide-react";
import { distanceLabel } from "../lib/geo";
import type { Candidate, Constraints, Place, Suggestion } from "../decision/types";

const THINKING = [
  "reading the neighborhood",
  "checking what's actually good",
  "cross-checking the receipts",
];

export function Thinking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % THINKING.length), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-8">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
        className="h-8 w-8 rounded-full border-2 border-rule border-t-accent"
      />
      <AnimatePresence mode="wait">
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="mt-5 font-sans text-[0.9rem] text-muted"
        >
          {THINKING[i]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/** Only rendered on a confident match — see the health adapters. */
function HealthChip({
  grade,
  score,
  critical,
}: {
  grade?: string | null;
  score?: number | null;
  critical?: boolean;
}) {
  if (!grade && score == null) return null;
  const label = grade ? `grade ${grade}` : `score ${score}`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-sans text-[0.68rem] ${
        critical
          ? "border-amber-400 bg-amber-50 text-amber-800"
          : "border-emerald-300 bg-emerald-50 text-emerald-800"
      }`}
    >
      {critical ? <ShieldAlert size={11} /> : <ShieldCheck size={11} />}
      {label}
    </span>
  );
}

export default function Results({
  suggestions,
  candidates,
  constraints,
  place,
  onOpen,
  onShare,
  onReroll,
  rerolling,
}: {
  suggestions: Suggestion[];
  candidates: Candidate[];
  constraints: Constraints;
  place: Place;
  onOpen: (c: Candidate) => void;
  onShare: (c: Candidate) => void;
  onReroll: () => void;
  rerolling: boolean;
}) {
  const byId = new Map(candidates.map((c) => [c.restaurant.id, c]));
  const picked = suggestions
    .map((s) => ({ s, c: byId.get(s.restaurant_id) }))
    .filter((x): x is { s: Suggestion; c: Candidate } => !!x.c);

  if (picked.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="font-serif text-2xl">nothing clean nearby.</p>
        <p className="mt-2 font-sans text-[0.9rem] text-muted">
          try a wider radius or a different vibe — we'd rather say nothing than
          send you somewhere bad.
        </p>
        <button
          onClick={onReroll}
          className="mt-6 rounded-full border border-ink/20 px-5 py-2.5 font-sans text-[0.85rem]"
        >
          try again
        </button>
      </div>
    );
  }

  const [hero, ...rest] = picked;

  return (
    <div className="px-5 pb-16 pt-8">
      <p className="font-sans text-[0.75rem] uppercase tracking-[0.18em] text-muted">
        near {place.neighborhood ?? place.city ?? "you"}
      </p>

      {/* HERO */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="mt-3 overflow-hidden rounded-3xl border border-rule bg-white"
      >
        <div className="p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-serif text-[1.7rem] font-semibold leading-tight tracking-tight">
              {hero.c.restaurant.name}
            </h2>
          </div>
          <p className="mt-1 font-sans text-[0.78rem] text-muted">
            {distanceLabel(hero.c.miles)}
            {hero.c.restaurant.price_tier
              ? ` · ${"$".repeat(hero.c.restaurant.price_tier)}`
              : ""}
            {hero.c.restaurant.neighborhood ? ` · ${hero.c.restaurant.neighborhood}` : ""}
          </p>

          <p className="mt-3 font-serif text-[1.15rem] leading-snug">
            {hero.s.one_liner_why}
          </p>

          {hero.s.best_dish_if_known && (
            <p className="mt-2 font-sans text-[0.85rem] text-muted">
              get the{" "}
              <span className="font-medium text-ink">
                {hero.s.best_dish_if_known}
              </span>
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <HealthChip
              grade={hero.c.healthGrade}
              score={hero.c.healthScore}
              critical={hero.c.healthCritical}
            />
            {hero.c.badges?.slice(0, 2).map((b, i) => (
              <span
                key={i}
                className="rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 font-sans text-[0.68rem] text-accent"
              >
                {b.label}
              </span>
            ))}
            {!hero.c.hasDossier && (
              <span className="rounded-full border border-rule px-2 py-0.5 font-sans text-[0.68rem] text-muted">
                not yet verified
              </span>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => onOpen(hero.c)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-accent py-3 font-sans text-[0.9rem] font-medium text-white"
            >
              {hero.c.hasDossier ? "receipts" : "run the check"}
              <ArrowRight size={15} />
            </button>
            <button
              onClick={() => onShare(hero.c)}
              className="rounded-full border border-ink/20 px-4 font-sans text-[0.85rem]"
              aria-label="share"
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Runner-ups */}
      <div className="mt-3 space-y-2">
        {rest.map(({ s, c }, i) => (
          <motion.button
            key={c.restaurant.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * (i + 1) }}
            onClick={() => onOpen(c)}
            className="flex w-full items-start gap-3 rounded-2xl border border-rule bg-white p-4 text-left"
          >
            <div className="min-w-0 flex-1">
              <p className="font-serif text-[1.05rem] font-semibold leading-tight">
                {c.restaurant.name}
              </p>
              <p className="font-sans text-[0.72rem] text-muted">
                {distanceLabel(c.miles)}
                {c.restaurant.price_tier
                  ? ` · ${"$".repeat(c.restaurant.price_tier)}`
                  : ""}
              </p>
              <p className="mt-1 line-clamp-2 font-sans text-[0.82rem] text-ink">
                {s.one_liner_why}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <HealthChip
                  grade={c.healthGrade}
                  score={c.healthScore}
                  critical={c.healthCritical}
                />
                {!c.hasDossier && (
                  <span className="rounded-full border border-rule px-2 py-0.5 font-sans text-[0.64rem] text-muted">
                    not yet verified
                  </span>
                )}
              </div>
            </div>
            <ArrowRight size={16} className="mt-1 shrink-0 text-muted" />
          </motion.button>
        ))}
      </div>

      <button
        onClick={onReroll}
        disabled={rerolling}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-rule py-3 font-sans text-[0.85rem] text-muted disabled:opacity-50"
      >
        <RefreshCw size={14} className={rerolling ? "animate-spin" : ""} />
        none of these
      </button>

      <p className="mt-4 text-center font-sans text-[0.68rem] text-muted/70">
        {constraints.vibes.join(" + ") || "anything"} ·{" "}
        {constraints.budgets.map((b) => "$".repeat(b)).join("/") || "any budget"}
      </p>
    </div>
  );
}
