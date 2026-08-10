import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Pencil, Send } from "lucide-react";
import {
  BUDGETS,
  DISTANCES,
  HUNGERS,
  VIBES,
  type Constraints,
  type DistanceId,
  type Place,
} from "../decision/types";
import { FALLBACK_PLACES, locate } from "../lib/location";
import { DEMO_PLACE, isDemo } from "../lib/demo";
import type { Vibe } from "../db/types";

type Step = 0 | 1 | 2 | 3 | 4;

const spring = { type: "spring" as const, stiffness: 420, damping: 32 };

function Bubble({ children, mine }: { children: React.ReactNode; mine?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className={`max-w-[85%] rounded-2xl px-4 py-2.5 font-sans text-[0.95rem] ${
        mine
          ? "ml-auto rounded-br-sm bg-accent text-white"
          : "mr-auto rounded-bl-sm bg-paper text-ink"
      }`}
    >
      {children}
    </motion.div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className={`shrink-0 rounded-2xl border px-4 py-3 text-left transition ${
        active
          ? "border-accent bg-accent-soft"
          : "border-rule bg-white hover:border-accent/40"
      }`}
    >
      {children}
    </motion.button>
  );
}

export default function Decide({
  onDone,
}: {
  onDone: (c: Constraints, p: Place) => void;
}) {
  const [place, setPlace] = useState<Place | null>(null);
  const [asking, setAsking] = useState(true);
  const [picker, setPicker] = useState(false);
  const [step, setStep] = useState<Step>(0);

  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [budgets, setBudgets] = useState<number[]>([]);
  const [distance, setDistance] = useState<DistanceId | null>(null);
  const [hunger, setHunger] = useState<number | null>(null);
  const [other, setOther] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [freeText, setFreeText] = useState("");

  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [step, showOther, place]);

  useEffect(() => {
    let alive = true;
    if (isDemo) {
      // No geolocation prompt on stage, and no network round trip.
      setAsking(false);
      setPlace(DEMO_PLACE);
      return;
    }
    void (async () => {
      const p = await locate();
      if (!alive) return;
      setAsking(false);
      if (p) setPlace(p);
      else setPicker(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  function toggle<T>(list: T[], v: T, set: (x: T[]) => void) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  function finish(over?: Partial<Constraints>) {
    if (!place) return;
    onDone(
      {
        vibes,
        budgets,
        distance: distance ?? "walk",
        hunger: hunger ?? 3,
        freeText: freeText || other || null,
        ...over,
      },
      place,
    );
  }

  return (
    <div className="flex min-h-full flex-col px-5 pb-28 pt-10">
      <h1 className="font-serif text-4xl leading-none tracking-tight text-accent">
        tablestakes
      </h1>
      <p className="mt-2 font-sans text-[0.95rem] text-muted">
        tell us nothing. we'll find it.
      </p>

      {/* Location */}
      <div className="mt-5">
        {asking && (
          <div className="rounded-2xl border border-rule bg-paper p-4">
            <p className="font-sans text-[0.9rem]">
              <MapPin size={14} className="mr-1.5 inline text-accent" />
              finding what's near you
            </p>
            <p className="mt-1 font-sans text-[0.78rem] text-muted">
              we only use your location to find what's nearby. nothing is stored.
            </p>
          </div>
        )}
        {place && (
          <button
            onClick={() => setPicker(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-white px-3 py-1.5 font-sans text-[0.8rem]"
          >
            <MapPin size={12} className="text-accent" />
            {place.label}
            <Pencil size={11} className="text-muted" />
          </button>
        )}
      </div>

      {/* Conversation */}
      {place && (
        <div className="mt-6 space-y-4">
          {/* Q1 vibe */}
          <Bubble>what's the move?</Bubble>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {VIBES.map((v) => (
              <Chip
                key={v.id}
                active={vibes.includes(v.id)}
                onClick={() => {
                  toggle(vibes, v.id, setVibes);
                  if (step < 1) setStep(1);
                }}
              >
                <span className="block text-2xl">{v.emoji}</span>
                <span className="mt-1 block font-sans text-[0.85rem] font-medium">
                  {v.label}
                </span>
                <span className="block font-sans text-[0.68rem] text-muted">
                  {v.hint}
                </span>
              </Chip>
            ))}
            <Chip
              active={showOther}
              onClick={() => {
                setShowOther((s) => !s);
                if (step < 1) setStep(1);
              }}
            >
              <span className="block text-2xl">✨</span>
              <span className="mt-1 block font-sans text-[0.85rem] font-medium">
                another
              </span>
              <span className="block font-sans text-[0.68rem] text-muted">
                you say it
              </span>
            </Chip>
          </div>

          {showOther && (
            <input
              autoFocus
              value={other}
              onChange={(e) => setOther(e.target.value)}
              placeholder="omakase, hookah, vegan brunch…"
              className="w-full rounded-xl border border-rule bg-white px-3 py-2.5 font-sans text-[0.9rem] outline-none focus:border-accent"
            />
          )}

          {vibes.length > 0 && (
            <Bubble mine>
              {vibes.map((v) => VIBES.find((x) => x.id === v)?.label).join(" + ")}
              {other ? ` + ${other}` : ""}
            </Bubble>
          )}

          {/* Q2 budget */}
          <AnimatePresence>
            {step >= 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <Bubble>damage?</Bubble>
                <div className="grid grid-cols-4 gap-2">
                  {BUDGETS.map((b) => (
                    <Chip
                      key={b.tier}
                      active={budgets.includes(b.tier)}
                      onClick={() => {
                        toggle(budgets, b.tier, setBudgets);
                        if (step < 2) setStep(2);
                      }}
                    >
                      <span className="block text-center font-serif text-lg font-semibold">
                        {b.glyph}
                      </span>
                      <span className="mt-0.5 block text-center font-sans text-[0.62rem] text-muted">
                        {b.hint}
                      </span>
                    </Chip>
                  ))}
                </div>
                {budgets.length > 0 && (
                  <Bubble mine>
                    {budgets
                      .sort()
                      .map((b) => "$".repeat(b))
                      .join(" / ")}
                  </Bubble>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Q3 distance */}
          <AnimatePresence>
            {step >= 2 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <Bubble>how far you willing to go?</Bubble>
                <div className="grid grid-cols-2 gap-2">
                  {DISTANCES.map((d) => (
                    <Chip
                      key={d.id}
                      active={distance === d.id}
                      onClick={() => {
                        setDistance(d.id);
                        if (step < 3) setStep(3);
                      }}
                    >
                      <span className="text-xl">{d.emoji}</span>
                      <span className="ml-1.5 font-sans text-[0.85rem] font-medium">
                        {d.label}
                      </span>
                      <span className="block font-sans text-[0.68rem] text-muted">
                        {d.hint}
                      </span>
                    </Chip>
                  ))}
                </div>
                {distance && (
                  <Bubble mine>
                    {DISTANCES.find((d) => d.id === distance)?.label}
                  </Bubble>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Q4 hunger */}
          <AnimatePresence>
            {step >= 3 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <Bubble>hunger check</Bubble>
                <div className="flex flex-wrap gap-2">
                  {HUNGERS.map((h) => (
                    <Chip
                      key={h.id}
                      active={hunger === h.id}
                      onClick={() => {
                        setHunger(h.id);
                        setStep(4);
                      }}
                    >
                      <span className="font-sans text-[0.85rem]">{h.label}</span>
                    </Chip>
                  ))}
                </div>
                {hunger && (
                  <Bubble mine>
                    {HUNGERS.find((h) => h.id === hunger)?.label}
                  </Bubble>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {step >= 4 && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => finish()}
                className="w-full rounded-2xl bg-accent py-4 font-sans text-base font-medium text-white"
              >
                find it
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      <div ref={bottom} />

      {/* "or just tell us" */}
      {place && (
        <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[430px] border-t border-rule bg-white/95 p-3 backdrop-blur">
          <div className="flex items-center gap-2 rounded-full border border-rule bg-paper px-3 py-2">
            <input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && freeText.trim()) finish({ freeText });
              }}
              placeholder="or just tell us…"
              className="w-full bg-transparent font-sans text-[0.85rem] outline-none placeholder:text-muted/70"
            />
            <button
              onClick={() => freeText.trim() && finish({ freeText })}
              disabled={!freeText.trim()}
              className="shrink-0 text-accent disabled:opacity-30"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Neighborhood picker */}
      <AnimatePresence>
        {picker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => place && setPicker(false)}
              className="fixed inset-0 z-40 bg-black/40"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={spring}
              className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[430px] rounded-t-3xl bg-white p-5"
            >
              <p className="font-serif text-xl">where are you?</p>
              <p className="mt-1 font-sans text-[0.8rem] text-muted">
                pick a neighborhood and we'll take it from there.
              </p>
              <div className="mt-4 space-y-2">
                {FALLBACK_PLACES.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => {
                      setPlace(p);
                      setPicker(false);
                    }}
                    className="w-full rounded-xl border border-rule px-4 py-3 text-left font-sans text-[0.9rem] hover:border-accent"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
