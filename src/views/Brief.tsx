import { useMemo, useState } from "react";
import SourceChip from "../components/SourceChip";
import RatingDistribution from "../components/charts/RatingDistribution";
import RatingOverTime from "../components/charts/RatingOverTime";
import MentionHeat from "../components/charts/MentionHeat";
import { dateRange, pulseEventDate } from "../lib/stats";
import { byPrestige } from "../sources";
import type {
  Analysis,
  ContextStat,
  Finding,
  KeyReview,
  ParsedReview,
  PatternTrend,
  Reply,
  SocialPulse,
} from "../types";

const TREND: Record<PatternTrend, { glyph: string; label: string; tone: string }> = {
  worsening: { glyph: "↑", label: "worsening", tone: "text-accent" },
  improving: { glyph: "↓", label: "improving", tone: "text-emerald-700" },
  stable: { glyph: "→", label: "stable", tone: "text-muted" },
  new: { glyph: "★", label: "new", tone: "text-accent" },
};

const WHY_LABEL: Record<KeyReview["why_chosen"], string> = {
  most_representative: "Most representative",
  most_alarming: "Most alarming",
  most_promising: "Most promising",
};

const BUZZ_STEPS = ["quiet", "steady", "buzzing", "viral"] as const;

function clean(q: string) {
  return q.replace(/^["“]|["”]$/g, "").trim();
}

function Excerpts({ quotes, sources }: { quotes: string[]; sources?: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {quotes.map((q, i) => (
        <li key={i} className="border-l-2 border-rule pl-3">
          <p className="font-serif text-[0.95rem] italic leading-snug text-muted">
            “{clean(q)}”
          </p>
          {sources?.[i] && (
            <span className="mt-1 inline-block">
              <SourceChip domain={sources[i]} size="xs" />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-rule pb-2 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted">
      {children}
    </h3>
  );
}

export default function Brief({
  restaurant,
  city,
  onNameChange,
  analysis,
  reviews,
  findings,
  social,
  contextStats,
  replies,
  repliesError,
  onRetryReplies,
}: {
  restaurant: string;
  city: string;
  onNameChange: (v: string) => void;
  analysis: Analysis;
  reviews: ParsedReview[];
  findings: Record<string, Finding[]>;
  social: SocialPulse | null;
  contextStats: ContextStat[];
  replies: Reply[] | null;
  repliesError: string | null;
  onRetryReplies: () => void;
}) {
  const [openReplies, setOpenReplies] = useState(false);

  /** Only domains that actually produced evidence — never decorate with a
   *  logo for a source that returned nothing. */
  const provenance = useMemo(() => {
    const s = new Set<string>();
    for (const r of reviews) if (r.source) s.add(r.source);
    for (const list of Object.values(findings ?? {}))
      for (const f of list) if (f.source && f.source !== "—") s.add(f.source);
    for (const m of social?.mentions ?? []) if (m.platform) s.add(m.platform);
    for (const p of analysis.patterns) for (const d of p.sources ?? []) s.add(d);
    return [...s].filter(Boolean).sort(byPrestige);
  }, [reviews, findings, social, analysis]);

  const pulseEvent = useMemo(
    () => pulseEventDate(findings?.pulse ?? []),
    [findings],
  );
  const range = dateRange(reviews);
  const buzzIdx = social ? BUZZ_STEPS.indexOf(social.buzz_level) : -1;

  return (
    <article className="print-page mx-auto max-w-3xl border border-rule bg-white px-10 py-12 shadow-sm">
      {/* 1 — Header + provenance */}
      <header className="border-b border-rule pb-6">
        <input
          value={restaurant}
          onChange={(e) => onNameChange(e.target.value)}
          aria-label="Restaurant name"
          className="w-full border-0 bg-transparent p-0 font-serif text-2xl font-semibold tracking-tight outline-none print:pointer-events-none"
        />
        <h1 className="mt-1 font-serif text-[2.6rem] leading-none tracking-tight text-accent">
          Operator Brief
        </h1>
        <p className="mt-3 text-sm text-muted">
          {new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          {" · "}
          {city}
          {" · "}
          {reviews.length} pieces of evidence
          {" · "}
          {provenance.length} sources
          {range.from ? ` · ${range.label}` : ""}
        </p>
        {provenance.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {provenance.map((d) => (
              <SourceChip key={d} domain={d} size="xs" />
            ))}
          </div>
        )}
      </header>

      {/* 2 — THE ONE FIX */}
      <section className="print-block mt-10 border-l-4 border-accent bg-accent-soft/60 px-7 py-7">
        <p className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent">
          The one fix
        </p>
        <h2 className="mt-3 font-serif text-[2rem] font-semibold leading-[1.15] tracking-tight">
          {analysis.one_fix.action}
        </h2>
        <p className="mt-4 max-w-2xl font-serif text-lg leading-relaxed">
          {analysis.one_fix.why_this_one}
        </p>
        <Excerpts quotes={analysis.one_fix.evidence} />
      </section>

      {/* 3 — Visual band */}
      <section className="mt-12 grid gap-8 sm:grid-cols-2">
        <RatingDistribution reviews={reviews} />
        <RatingOverTime reviews={reviews} event={pulseEvent} />
      </section>

      {/* 4 — Patterns */}
      <section className="mt-12">
        <SectionLabel>Patterns</SectionLabel>
        <div className="divide-y divide-rule">
          {analysis.patterns.map((p, i) => {
            const t = TREND[p.trend] ?? TREND.stable;
            return (
              <div key={i} className="print-block py-6">
                <div className="flex items-baseline justify-between gap-4">
                  <h4 className="font-serif text-xl font-semibold leading-snug">
                    {p.title}
                  </h4>
                  <span className={`shrink-0 font-sans text-sm ${t.tone}`}>
                    {t.glyph} {t.label}
                  </span>
                </div>
                <p className="mt-1 font-sans text-xs uppercase tracking-widest text-muted">
                  {p.category} · {p.frequency}
                </p>
                <Excerpts quotes={p.excerpts} />
                {p.sources?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.sources.map((d) => (
                      <SourceChip key={d} domain={d} size="xs" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 5 — Voices */}
      {analysis.key_reviews?.length > 0 && (
        <section className="print-block mt-12">
          <SectionLabel>Voices</SectionLabel>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {analysis.key_reviews.map((k, i) => (
              <div key={i} className="border border-rule bg-paper p-4">
                <p className="font-sans text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-accent">
                  {WHY_LABEL[k.why_chosen] ?? k.why_chosen}
                </p>
                <p className="mt-2 font-serif text-[0.95rem] italic leading-snug">
                  “{clean(k.quote)}”
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {typeof k.stars === "number" && (
                    <span className="font-sans text-sm tracking-tight text-accent">
                      {"★".repeat(Math.round(k.stars))}
                      <span className="text-rule">
                        {"★".repeat(Math.max(0, 5 - Math.round(k.stars)))}
                      </span>
                    </span>
                  )}
                  {k.source && <SourceChip domain={k.source} size="xs" />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6 — Mention heat */}
      <section className="mt-12">
        <MentionHeat reviews={reviews} />
      </section>

      {/* 7 — What changed */}
      <section className="print-block mt-10 border-y-2 border-ink/15 bg-paper px-6 py-5">
        <p className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted">
          What changed
        </p>
        <p className="mt-2 font-serif text-lg leading-relaxed">{analysis.delta}</p>
        {pulseEvent && (
          <p className="mt-3 border-l-2 border-accent pl-3 font-sans text-sm text-muted">
            <span className="font-semibold text-accent">Likely cause · </span>
            {pulseEvent.finding}
            <span className="text-muted/70"> ({pulseEvent.date})</span>
          </p>
        )}
      </section>

      {/* 8 — Second opinion */}
      {analysis.corroboration && (
        <section className="print-block mt-10">
          <SectionLabel>Second opinion</SectionLabel>
          <p className="mt-4 font-serif text-lg leading-relaxed">
            {analysis.corroboration}
          </p>
        </section>
      )}

      {/* 9 — Bright spots */}
      {analysis.bright_spots?.length > 0 && (
        <section className="print-block mt-10">
          <SectionLabel>Bright spots</SectionLabel>
          {analysis.bright_spots.map((b, i) => (
            <div key={i} className="py-4">
              <p className="font-serif text-base font-semibold">{b.finding}</p>
              <Excerpts quotes={b.excerpts} />
            </div>
          ))}
        </section>
      )}

      {/* 10 — Social pulse */}
      {social && (
        <section className="print-block mt-10 border border-rule bg-paper px-6 py-5">
          <p className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted">
            Social pulse
          </p>
          {social.buzz_level === "quiet" && social.mentions.length === 0 ? (
            <p className="mt-2 font-sans text-sm text-muted">{social.driving_it}</p>
          ) : (
            <>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex gap-1">
                  {BUZZ_STEPS.map((s, i) => (
                    <span
                      key={s}
                      className={`h-2 w-9 rounded-sm ${
                        i <= buzzIdx ? "bg-accent" : "bg-rule"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-serif text-lg font-semibold capitalize">
                  {social.buzz_level}
                </span>
              </div>
              <p className="mt-2 font-sans text-sm text-muted">
                <span className="font-semibold text-ink">Driven by: </span>
                {social.driving_it}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[...new Set(social.mentions.map((m) => m.platform))].map((p) => (
                  <SourceChip key={p} domain={p} size="xs" />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* 11 — Why this matters */}
      {contextStats.length > 0 && (
        <section className="print-block mt-10">
          <SectionLabel>Why this matters</SectionLabel>
          <ul className="mt-4 space-y-2">
            {contextStats.slice(0, 3).map((s, i) => (
              <li key={i} className="text-sm leading-relaxed text-muted">
                {s.stat}{" "}
                <span className="italic text-muted/70">— {s.source}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 12 — Footer */}
      <footer className="mt-12 border-t border-rule pt-6">
        <button
          onClick={() => setOpenReplies((v) => !v)}
          className="no-print font-sans text-sm font-medium text-accent underline underline-offset-4"
        >
          {openReplies ? "Hide" : "Show"} suggested replies to recent reviews
        </button>

        <div className={openReplies ? "block" : "hidden print-open"}>
          <p className="hidden font-sans text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted print:block">
            Suggested replies
          </p>
          {repliesError && (
            <div className="no-print mt-4 text-sm text-accent">
              {repliesError}{" "}
              <button onClick={onRetryReplies} className="underline underline-offset-4">
                Retry
              </button>
            </div>
          )}
          {!replies && !repliesError && (
            <p className="mt-4 text-sm text-muted">Drafting replies…</p>
          )}
          {replies?.map((r, i) => (
            <div key={i} className="print-block mt-5">
              <p className="font-serif text-sm italic text-muted">
                Re: “{r.review_excerpt}…”
              </p>
              <p className="mt-1 font-serif text-base leading-relaxed">{r.reply}</p>
            </div>
          ))}
        </div>

        <div className="no-print mt-8 flex items-center justify-between">
          <p className="text-xs text-muted">
            Tablestakes · {reviews.length} pieces of evidence across{" "}
            {provenance.length} sources.
          </p>
          <button
            onClick={() => window.print()}
            className="border border-ink/25 px-5 py-2 font-sans text-sm font-medium hover:bg-ink hover:text-white"
          >
            Print this brief
          </button>
        </div>
      </footer>
    </article>
  );
}
