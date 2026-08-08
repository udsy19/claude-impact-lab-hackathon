import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { completeJSON } from "../api/claude";
import { PARSE_PROMPT } from "../prompts";
import { SAMPLE_REVIEWS } from "../fixtures/sample_reviews";
import type { ParsedReview } from "../types";

export default function PasteDrawer({
  open,
  onClose,
  onParsed,
}: {
  open: boolean;
  onClose: () => void;
  onParsed: (reviews: ParsedReview[]) => void;
}) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function parse() {
    setBusy(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const parsed = await completeJSON<ParsedReview[]>(
        PARSE_PROMPT(raw, today),
        16000,
      );
      const clean = (Array.isArray(parsed) ? parsed : [])
        .filter((r) => r && typeof r.text === "string" && r.text.trim())
        .map((r) => ({ ...r, source: "pasted" }));
      if (clean.length === 0) {
        setError("No reviews came through. Check the paste and try again.");
        return;
      }
      onParsed(clean);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse that paste.");
    } finally {
      setBusy(false);
    }
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
            className="no-print fixed inset-0 z-40 bg-black/60"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="no-print fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-[#232a33] bg-[#12151a] p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-serif text-2xl text-slate-100">Paste reviews</h2>
                <p className="mt-1 font-mono text-[0.7rem] text-[#7c8899]">
                  Any format. Claude does the parsing.
                </p>
              </div>
              <button onClick={onClose} className="text-[#7c8899] hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              disabled={busy}
              placeholder="Copy reviews straight out of Google Maps or Yelp — names, stars, dates, 'Useful 3 Funny 0', all of it. Messy is fine."
              className="scroll-thin mt-5 flex-1 resize-none rounded border border-[#232a33] bg-[#0f1216] p-3 font-mono text-[0.72rem] leading-relaxed text-[#c3d0de] outline-none placeholder:text-[#4a5563] focus:border-[#3a4553] disabled:opacity-60"
            />

            <div className="mt-2 flex items-center justify-between font-mono text-[0.7rem]">
              <button
                onClick={() => setRaw(SAMPLE_REVIEWS)}
                disabled={busy}
                className="text-[#d2603f] underline underline-offset-4 disabled:opacity-40"
              >
                load sample
              </button>
              <span className="text-[#5f6c7d]">
                {raw.trim() ? `${raw.trim().length.toLocaleString()} chars` : ""}
              </span>
            </div>

            {error && (
              <div className="mt-3 rounded border border-[#7a5a1f] bg-[#1c1710] p-3">
                <p className="font-mono text-[0.7rem] text-[#d99a3f]">{error}</p>
                <button
                  onClick={parse}
                  className="mt-1 font-mono text-[0.7rem] text-[#d99a3f] underline underline-offset-4"
                >
                  retry
                </button>
              </div>
            )}

            <button
              onClick={parse}
              disabled={busy || raw.trim().length < 50}
              className="mt-4 rounded bg-[#d2603f] px-5 py-2.5 font-mono text-sm text-white disabled:opacity-35"
            >
              {busy ? "parsing…" : "add to evidence"}
            </button>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
