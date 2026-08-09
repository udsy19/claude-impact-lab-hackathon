import { useEffect, useState } from "react";
import { ArrowRight, ShieldAlert, ShieldCheck } from "lucide-react";
import { db } from "../db";
import { setOgTags, shareUrl } from "../lib/share";
import type { DossierRow, Restaurant } from "../db/types";

/** Public, read-only. This is what lands in a group chat. */
export default function SharePage({ slug }: { slug: string }) {
  const [data, setData] = useState<
    { dossier: DossierRow; restaurant: Restaurant } | null | "missing"
  >(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const card = await db.shareCardBySlug(slug);
      if (!alive) return;
      if (!card) {
        setData("missing");
        return;
      }
      setData({ dossier: card.dossier, restaurant: card.restaurant });
      setOgTags({
        title: `${card.restaurant.name} — verified`,
        description: card.dossier.verdict ?? "Verified by Tablestakes.",
        image: card.og_image,
        url: shareUrl(slug),
      });
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  if (data === null) {
    return <div className="px-6 py-24 text-center font-sans text-muted">loading…</div>;
  }

  if (data === "missing") {
    return (
      <div className="px-6 py-24 text-center">
        <p className="font-serif text-2xl">that link has expired.</p>
        <a
          href="/"
          className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 font-sans text-[0.9rem] text-white"
        >
          find where you should eat
        </a>
      </div>
    );
  }

  const { dossier: d, restaurant: r } = data;
  const health = d.health;
  const dv = d.diner_view as { order_this?: string[] } | null;
  const badges = (d.badges as { label: string }[]) ?? [];

  return (
    <div className="px-5 py-10">
      <div className="overflow-hidden rounded-3xl border border-rule bg-white">
        <div className="p-6">
          <p className="font-sans text-[0.68rem] uppercase tracking-[0.2em] text-accent">
            verified
          </p>
          <h1 className="mt-1 font-serif text-[2rem] font-semibold leading-tight tracking-tight">
            {r.name}
          </h1>
          <p className="font-sans text-[0.8rem] text-muted">
            {[r.neighborhood, r.city].filter(Boolean).join(", ")}
          </p>

          <p className="mt-4 border-l-4 border-accent pl-3 font-serif text-[1.2rem] leading-snug">
            {d.verdict}
          </p>

          {dv?.order_this?.[0] && (
            <p className="mt-4 font-sans text-[0.9rem]">
              <span className="text-muted">get the </span>
              <span className="font-medium">{dv.order_this[0]}</span>
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-1.5">
            {badges.slice(0, 3).map((b, i) => (
              <span
                key={i}
                className="rounded-full border border-accent/30 bg-accent-soft px-2.5 py-1 font-sans text-[0.7rem] text-accent"
              >
                {b.label}
              </span>
            ))}
            {health?.status === "matched" && (health.grade || health.score != null) && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-sans text-[0.7rem] ${
                  health.critical_violations.length
                    ? "border-amber-400 bg-amber-50 text-amber-800"
                    : "border-emerald-300 bg-emerald-50 text-emerald-800"
                }`}
              >
                {health.critical_violations.length ? (
                  <ShieldAlert size={11} />
                ) : (
                  <ShieldCheck size={11} />
                )}
                {health.grade ? `grade ${health.grade}` : `score ${health.score}`}
              </span>
            )}
          </div>

          <p className="mt-6 font-sans text-[0.7rem] text-muted">
            {d.evidence_count} pieces of evidence across {d.sources.length} sources ·
            verified by tablestakes
          </p>
        </div>

        <a
          href="/"
          className="flex items-center justify-center gap-2 border-t border-rule bg-paper py-4 font-sans text-[0.9rem] font-medium text-accent"
        >
          find where YOU should eat
          <ArrowRight size={15} />
        </a>
      </div>

      <a
        href={`/claim/${r.slug}`}
        className="mt-5 block text-center font-sans text-[0.75rem] text-muted underline underline-offset-4"
      >
        own this place? claim your brief
      </a>
    </div>
  );
}
