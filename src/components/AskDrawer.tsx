import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, X } from "lucide-react";
import SourceChip from "./SourceChip";
import { completeJSON } from "../api/claude";
import { ASK_PROMPT } from "../prompts";

type Msg =
  | { role: "user"; text: string }
  | { role: "answer"; text: string; sources: string[] };

const SUGGESTIONS = [
  "What should I order?",
  "Can I get in on a Saturday?",
  "What do people complain about?",
];

/** Grounded Q&A over the evidence the swarm actually collected. */
export default function AskDrawer({
  open,
  onClose,
  restaurant,
  evidence,
  brief,
}: {
  open: boolean;
  onClose: () => void;
  restaurant: string;
  evidence: string;
  brief: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Last question asked — kept so a failed request can be retried verbatim. */
  const [pending, setPending] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 320);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, busy, error]);

  /** Runs a question that is already on screen. Never throws. */
  async function run(question: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await completeJSON<{ answer: string; sources: string[] }>(
        ASK_PROMPT(restaurant, question, evidence, brief),
        1200,
      );
      const answer = typeof res?.answer === "string" ? res.answer.trim() : "";
      if (!answer) throw new Error("The answer came back empty.");
      const sources = Array.isArray(res?.sources)
        ? res.sources.filter((s): s is string => typeof s === "string" && !!s)
        : [];
      setMessages((m) => [...m, { role: "answer", text: answer, sources }]);
      setPending(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "That question didn't go through.",
      );
    } finally {
      setBusy(false);
    }
  }

  function ask(raw: string) {
    const question = raw.trim();
    if (!question || busy) return;
    setInput("");
    setPending(question);
    setMessages((m) => [...m, { role: "user", text: question }]);
    void run(question);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="no-print fixed inset-0 z-40 bg-black/45"
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`Ask about ${restaurant}`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="no-print fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[80vh] max-h-[680px] w-full max-w-[430px] flex-col rounded-t-2xl border border-rule bg-paper shadow-[0_-8px_40px_rgba(28,26,23,0.18)]"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-rule px-4 pb-3 pt-3">
              <div className="min-w-0">
                <p className="font-sans text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-accent">
                  Ask the evidence
                </p>
                <h2 className="mt-0.5 truncate font-serif text-lg font-semibold leading-tight">
                  {restaurant}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 -mt-1 shrink-0 rounded p-1 text-muted transition-colors hover:text-ink"
              >
                <X size={17} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              {messages.length === 0 && !busy && (
                <div>
                  <p className="font-serif text-[0.95rem] leading-relaxed text-muted">
                    Answers come only from what the swarm actually read — no
                    guessing, sources attached.
                  </p>
                  <div className="mt-4 space-y-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => ask(s)}
                        className="block w-full rounded-full border border-rule bg-white px-3.5 py-2 text-left font-sans text-[0.78rem] text-ink transition-colors hover:border-accent hover:text-accent"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="flex justify-end">
                      <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent-soft px-3.5 py-2 font-sans text-[0.82rem] leading-snug text-ink">
                        {m.text}
                      </p>
                    </div>
                  ) : (
                    <div key={i} className="max-w-[92%]">
                      <p className="rounded-2xl rounded-bl-sm border border-rule bg-white px-3.5 py-2.5 font-serif text-[0.92rem] leading-relaxed text-ink">
                        {m.text}
                      </p>
                      {m.sources.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {[...new Set(m.sources)].map((d) => (
                            <SourceChip key={d} domain={d} size="xs" />
                          ))}
                        </div>
                      )}
                    </div>
                  ),
                )}

                {busy && (
                  <p className="font-sans text-[0.72rem] italic text-muted">
                    reading the evidence…
                  </p>
                )}

                {error && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                    <p className="font-sans text-[0.72rem] leading-snug text-amber-800">
                      {error}
                    </p>
                    {pending && (
                      <button
                        type="button"
                        onClick={() => void run(pending)}
                        disabled={busy}
                        className="mt-1 font-sans text-[0.72rem] font-medium text-amber-800 underline underline-offset-4 disabled:opacity-40"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div ref={endRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
              className="flex items-center gap-2 border-t border-rule bg-paper px-3 py-3"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
                placeholder="Ask anything about this place…"
                aria-label="Your question"
                className="min-w-0 flex-1 rounded-full border border-rule bg-white px-3.5 py-2 font-sans text-[0.82rem] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white transition-opacity disabled:opacity-30"
              >
                <ArrowUp size={16} strokeWidth={2.5} />
              </button>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
