import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

/**
 * Every Disclosure opens for real while the print dialog is up.
 *
 * The `hidden print-open` copy alone is not enough for charts: a recharts
 * ResponsiveContainer inside a `display: none` subtree measures zero width and
 * renders no SVG, so the mention-heat chart printed blank. Genuinely opening
 * the disclosure gives it a laid-out box to measure.
 */
function usePrinting(): boolean {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const on = () => setPrinting(true);
    const off = () => setPrinting(false);
    window.addEventListener("beforeprint", on);
    window.addEventListener("afterprint", off);
    const mq = window.matchMedia?.("print");
    const onChange = (e: MediaQueryListEvent) => setPrinting(e.matches);
    mq?.addEventListener?.("change", onChange);
    return () => {
      window.removeEventListener("beforeprint", on);
      window.removeEventListener("afterprint", off);
      mq?.removeEventListener?.("change", onChange);
    };
  }, []);
  return printing;
}

/**
 * Progressive disclosure. Verdict stays on screen; evidence comes on demand.
 *
 * Print contract: the trigger carries `no-print`, and the collapsed body is
 * rendered as a plain `hidden print-open` div with NO inline styles — framer
 * only ever touches the element while it is open, so nothing survives to fight
 * `display: block !important` on paper.
 */
export default function Disclosure({
  label = "receipts",
  count,
  children,
  defaultOpen = false,
}: {
  label?: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [userOpen, setUserOpen] = useState(defaultOpen);
  const printing = usePrinting();
  const open = userOpen || printing;
  /** True only once the collapse animation has fully unmounted, so the print
   *  copy never coexists with the animating copy. */
  const [settled, setSettled] = useState(!defaultOpen);

  const suffix = typeof count === "number" ? ` · ${count}` : "";

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setUserOpen((v) => !v);
          setSettled(false);
        }}
        className="no-print -ml-0.5 inline-flex items-center gap-1 rounded px-0.5 py-1 font-sans text-[0.72rem] font-medium tracking-tight text-accent transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ChevronRight
          size={12}
          strokeWidth={2.5}
          className={`shrink-0 transition-transform duration-200 ease-out ${
            open ? "rotate-90" : "rotate-0"
          }`}
        />
        {open ? "hide" : "show"} {label}
        {suffix}
      </button>

      <AnimatePresence initial={false} onExitComplete={() => setSettled(true)}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            /* overflow-hidden lives on the animating wrapper only; the inner
               div is unclipped so nothing gets cut off mid-tween. The print
               overrides are belt-and-braces — a stylesheet !important beats a
               non-important inline style. */
            className="overflow-hidden print:h-auto! print:overflow-visible! print:opacity-100!"
          >
            <div className="pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {!open && settled && <div className="hidden print-open">{children}</div>}
    </div>
  );
}
