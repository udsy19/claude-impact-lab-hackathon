import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  Newspaper,
  Radio,
  ShieldCheck,
  Sparkles,
  Star,
  Utensils,
} from "lucide-react";
import type { ComponentType } from "react";
import SourceChip from "../components/SourceChip";
import { averageRating, dateRange } from "../lib/stats";
import type { AgentId, AgentState, SwarmState } from "../types";

const ICONS: Record<AgentId, ComponentType<{ size?: number; className?: string }>> = {
  reviews: Star,
  press: Newspaper,
  pulse: Radio,
  social: Sparkles,
  menu: Utensils,
  inspector: ShieldCheck,
  context: FileText,
};

const ORDER: AgentId[] = [
  "reviews",
  "press",
  "pulse",
  "social",
  "menu",
  "inspector",
  "context",
];

function AgentCard({ a }: { a: AgentState }) {
  const Icon = ICONS[a.id];
  const live = ["spawned", "searching", "reading", "extracting"].includes(a.status);
  const failed = a.status === "failed";
  const done = a.status === "done";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className={`rounded-lg border p-4 ${
        failed
          ? "border-[#7a5a1f] bg-[#1c1710]"
          : done
            ? "border-[#26483c] bg-[#101a17]"
            : live
              ? "agent-live border-[#3a2a22] bg-[#171b21]"
              : "border-[#232a33] bg-[#12151a]"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Icon
          size={16}
          className={
            failed
              ? "text-[#d99a3f]"
              : done
                ? "text-[#3fb98a]"
                : live
                  ? "text-[#d2603f]"
                  : "text-[#7c8899]"
          }
        />
        <span className="font-mono text-[0.72rem] font-semibold tracking-[0.18em] text-slate-200">
          {a.label}
        </span>
        <span className="ml-auto">
          {done && <Check size={15} className="text-[#3fb98a]" />}
          {failed && <AlertTriangle size={15} className="text-[#d99a3f]" />}
          {live && <Loader2 size={14} className="animate-spin text-[#d2603f]" />}
        </span>
      </div>

      <p
        className={`mt-2 font-mono text-[0.7rem] leading-relaxed ${
          failed ? "text-[#d99a3f]" : done ? "text-[#3fb98a]" : "text-[#9fb0c2]"
        }`}
      >
        {a.error ?? a.statusLine ?? "waiting…"}
      </p>

      {a.log.length > 0 && (
        <div className="mt-2 space-y-0.5 border-l border-[#232a33] pl-2">
          {a.log.map((l, i) => (
            <p key={i} className="font-mono text-[0.62rem] text-[#5f6c7d]">
              <span className="text-[#3f4a58]">+{(l.t / 1000).toFixed(1)}s</span>{" "}
              {l.text}
            </p>
          ))}
        </div>
      )}

      {a.domains.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {a.domains.map((d) => (
            <SourceChip key={d} domain={d} size="xs" dark />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[#5f6c7d]">
        {label}
      </p>
      <p className="font-mono text-sm text-slate-200">{value}</p>
    </div>
  );
}

export default function Engine({
  state,
  onOpenPaste,
}: {
  state: SwarmState;
  onOpenPaste: () => void;
}) {
  const agents = ORDER.map((id) => state.agents[id]).filter(
    (a) => a && a.status !== "idle",
  );
  const avg = averageRating(state.reviews);
  const range = dateRange(state.reviews);
  const synthesizing = state.narration.length > 0;

  return (
    /* Single column: this lives inside a 430px phone frame. */
    <div className="engine-root px-4 py-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-2xl tracking-tight text-slate-100">
            {state.restaurant}
          </h1>
          <p className="mt-0.5 font-mono text-[0.68rem] text-[#7c8899]">
            {state.city} · {agents.filter((a) => a.status === "done").length}/
            {agents.length} settled
          </p>
        </div>
        <button
          onClick={onOpenPaste}
          className="shrink-0 rounded border border-[#232a33] px-2.5 py-1.5 font-mono text-[0.65rem] text-[#9fb0c2] hover:border-[#3a4553] hover:text-slate-200"
        >
          paste
        </button>
      </header>

      {/* Counter first — it is the number that climbs during the demo. */}
      <div className="mt-4 rounded-lg border border-[#232a33] bg-[#12151a] px-4 py-3">
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-[0.62rem] tracking-[0.18em] text-[#7c8899]">
            EVIDENCE COLLECTED
          </p>
          <p className="font-mono text-3xl leading-none text-[#d2603f] tabular-nums">
            {state.evidence.length}
          </p>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Stat label="reviews" value={String(state.reviews.length)} />
          <Stat label="avg" value={avg === null ? "—" : `${avg.toFixed(1)}★`} />
          <Stat
            label="span"
            value={range.from ? range.label.replace(/ /g, "") : "—"}
          />
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {/* Agent grid + synthesis */}
        <div>
          <div className="grid gap-2.5 grid-cols-1 min-[380px]:grid-cols-2">
            <AnimatePresence>
              {agents.map((a) => (
                <AgentCard key={a.id} a={a} />
              ))}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {synthesizing && (
              <motion.section
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-6 overflow-hidden rounded-lg border border-[#3a2a22] bg-[#12151a]"
              >
                <div className="flex items-center gap-2 border-b border-[#232a33] px-4 py-2.5">
                  <Loader2 size={13} className="animate-spin text-[#d2603f]" />
                  <span className="font-mono text-[0.68rem] tracking-[0.18em] text-[#d2603f]">
                    SYNTHESIS
                  </span>
                </div>
                <pre className="scroll-thin max-h-[340px] overflow-y-auto whitespace-pre-wrap px-4 py-4 font-mono text-[0.74rem] leading-relaxed text-[#c3d0de]">
                  {state.narration}
                  <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-[#d2603f] align-middle" />
                </pre>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Evidence ticker — below the agents in the phone column */}
        <aside className="rounded-lg border border-[#232a33] bg-[#12151a]">
          <div className="scroll-thin max-h-[46vh] space-y-2 overflow-y-auto p-3">
            <AnimatePresence initial={false}>
              {state.evidence.slice(0, 40).map((e) => (
                <motion.div
                  key={e.id}
                  layout
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded border border-[#1d242c] bg-[#0f1216] p-2.5"
                >
                  <p className="line-clamp-3 text-[0.74rem] leading-snug text-[#aebbca]">
                    {e.text}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <SourceChip domain={e.source} size="xs" dark />
                    {typeof e.stars === "number" && (
                      <span className="font-mono text-[0.62rem] text-[#d2603f]">
                        {"★".repeat(Math.round(e.stars))}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {state.evidence.length === 0 && (
              <p className="px-1 py-6 text-center font-mono text-[0.7rem] text-[#4a5563]">
                waiting for first findings…
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
