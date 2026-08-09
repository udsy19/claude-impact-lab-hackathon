import { useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";
import { db } from "../db";
import type { DossierRow, Restaurant } from "../db/types";

/** Owner-side stub: a real page and a real email capture, no dashboard. */
export default function ClaimPage({ slug }: { slug: string }) {
  const [r, setR] = useState<Restaurant | null>(null);
  const [d, setD] = useState<DossierRow | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const rest = await db.restaurantBySlug(slug);
      if (!alive) return;
      setR(rest);
      if (rest) setD(await db.dossierFor(rest.id));
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  async function submit() {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("that doesn't look like an email");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await db.claimOwner(r?.id ?? null, email.trim());
      setSent(true);
    } catch {
      setError("couldn't save that — try again");
    } finally {
      setBusy(false);
    }
  }

  const patterns = (d?.patterns as { title: string }[]) ?? [];
  const name = r?.name ?? slug.replace(/-/g, " ");

  return (
    <div className="px-5 py-12">
      <p className="font-sans text-[0.68rem] uppercase tracking-[0.2em] text-accent">
        operator brief
      </p>
      <h1 className="mt-1 font-serif text-[2rem] font-semibold leading-tight tracking-tight">
        {name}
      </h1>

      <p className="mt-4 font-sans text-[0.95rem] leading-relaxed">
        Tablestakes found{" "}
        <span className="font-semibold">{d?.evidence_count ?? 0} findings</span> across{" "}
        <span className="font-semibold">{d?.sources.length ?? 0} sources</span> for{" "}
        {name}. Claim your brief to see the full analysis and get alerted when
        something changes.
      </p>

      {/* Teaser: pattern titles visible, receipts blurred. */}
      <div className="mt-6 space-y-2">
        {patterns.slice(0, 3).map((p, i) => (
          <div key={i} className="rounded-xl border border-rule bg-white p-4">
            <p className="font-serif text-[1rem] font-semibold leading-snug">
              {p.title}
            </p>
            <div className="mt-2 select-none space-y-1.5" aria-hidden>
              <p className="rounded bg-paper px-2 py-1 font-serif text-[0.85rem] italic text-muted blur-[3px]">
                “the carnitas were dry again, third time this month…”
              </p>
              <p className="rounded bg-paper px-2 py-1 font-serif text-[0.85rem] italic text-muted blur-[3px]">
                “waited forty minutes on a friday for a table we reserved…”
              </p>
            </div>
          </div>
        ))}
        {patterns.length === 0 && (
          <div className="rounded-xl border border-rule bg-white p-4">
            <p className="font-sans text-[0.85rem] text-muted">
              We haven't run the full analysis for {name} yet. Claim it and we'll
              run it and send it over.
            </p>
          </div>
        )}
      </div>

      {sent ? (
        <div className="mt-8 rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
          <p className="flex items-center gap-2 font-sans text-[0.95rem] font-medium text-emerald-900">
            <Check size={16} /> you're on the list
          </p>
          <p className="mt-1 font-sans text-[0.82rem] text-emerald-800">
            We'll email {email} when your brief is ready.
          </p>
        </div>
      ) : (
        <div className="mt-8">
          <div className="flex items-center gap-2 rounded-full border border-rule bg-white px-4 py-3">
            <Lock size={14} className="shrink-0 text-muted" />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              type="email"
              inputMode="email"
              placeholder="you@restaurant.com"
              className="w-full bg-transparent font-sans text-[0.9rem] outline-none placeholder:text-muted/60"
            />
          </div>
          <button
            onClick={() => void submit()}
            disabled={busy}
            className="mt-3 w-full rounded-full bg-accent py-3.5 font-sans text-[0.95rem] font-medium text-white disabled:opacity-50"
          >
            {busy ? "…" : "claim your brief"}
          </button>
          {error && (
            <p className="mt-2 font-sans text-[0.8rem] text-accent">{error}</p>
          )}
          <p className="mt-3 font-sans text-[0.7rem] text-muted">
            No account, no card. We'll email you once.
          </p>
        </div>
      )}
    </div>
  );
}
