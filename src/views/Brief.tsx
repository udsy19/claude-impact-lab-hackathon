import { useMemo, useState } from "react";
import {
  Award,
  CalendarClock,
  Clock,
  MessageCircle,
  Printer,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import SourceChip from "../components/SourceChip";
import Disclosure from "../components/Disclosure";
import RatingDistribution from "../components/charts/RatingDistribution";
import RatingOverTime from "../components/charts/RatingOverTime";
import MentionHeat from "../components/charts/MentionHeat";
import { averageRating, dateRange, pulseEventDate } from "../lib/stats";
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

const TREND: Record<PatternTrend, { glyph: string; tone: string }> = {
  worsening: { glyph: "↑", tone: "text-accent" },
  improving: { glyph: "↓", tone: "text-emerald-700" },
  stable: { glyph: "→", tone: "text-muted" },
  new: { glyph: "★", tone: "text-accent" },
};

const WHY: Record<KeyReview["why_chosen"], string> = {
  most_representative: "Representative",
  most_alarming: "Alarming",
  most_promising: "Promising",
};

const clean = (q: string) => q.replace(/^["“]|["”]$/g, "").trim();

function Receipts({ quotes, sources }: { quotes: string[]; sources?: string[] }) {
  return (
    <ul className="mt-2 space-y-2">
      {quotes.map((q, i) => (
        <li key={i} className="border-l-2 border-rule pl-3">
          <p className="font-serif text-[0.85rem] italic leading-snug text-muted">
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-sans text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">
      {children}
    </h3>
  );
}

function Chip({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-white px-2.5 py-1 font-sans text-[0.7rem] text-ink">
      <Icon size={12} className="text-muted" />
      {children}
    </span>
  );
}

/** Photos are cosmetic — a broken one hides itself rather than showing a box. */
function PhotoStrip({ images }: { images: string[] }) {
  const [dead, setDead] = useState<Record<string, boolean>>({});
  const live = images.filter((u) => !dead[u]).slice(0, 5);
  if (live.length === 0) return null;
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {live.map((u) => (
        <img
          key={u}
          src={u}
          alt=""
          loading="lazy"
          onError={() => setDead((d) => ({ ...d, [u]: true }))}
          className="h-24 w-32 shrink-0 rounded-lg border border-rule object-cover"
        />
      ))}
    </div>
  );
}

export default function Brief({
  restaurant,
  city,
  analysis,
  reviews,
  findings,
  social,
  contextStats,
  images,
  replies,
  repliesError,
  onRetryReplies,
  onAsk,
}: {
  restaurant: string;
  city: string;
  analysis: Analysis;
  reviews: ParsedReview[];
  findings: Record<string, Finding[]>;
  social: SocialPulse | null;
  contextStats: ContextStat[];
  images: string[];
  replies: Reply[] | null;
  repliesError: string | null;
  onRetryReplies: () => void;
  onAsk?: () => void;
}) {
  const [mode, setMode] = useState<"owner" | "diner">("owner");

  /** Only domains that actually produced evidence. Never decorative. */
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
  const avg = averageRating(reviews);
  const range = dateRange(reviews);
  const v = analysis.vitals;
  const diner = analysis.diner_view;

  return (
    <article className="print-page bg-white">
      {/* ---------- Mode toggle ---------- */}
      {diner && (
        <div className="no-print sticky top-0 z-10 flex gap-1 border-b border-rule bg-white/95 p-2 backdrop-blur">
          {(["owner", "diner"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md py-1.5 font-sans text-[0.75rem] font-medium capitalize transition ${
                mode === m
                  ? "bg-accent text-white"
                  : "bg-paper text-muted hover:text-ink"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      <div className="px-5 py-5">
        {/* ---------- AT A GLANCE ---------- */}
        <header className="print-block">
          <PhotoStrip images={images} />

          <div className="mt-3 flex items-start gap-2">
            <h1 className="font-serif text-[1.75rem] font-semibold leading-tight tracking-tight">
              {restaurant}
            </h1>
            {analysis.badges?.length > 0 && (
              <Award size={16} className="mt-2 shrink-0 text-accent" />
            )}
          </div>
          <p className="font-sans text-[0.75rem] text-muted">{city}</p>

          {analysis.badges?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {analysis.badges.map((b, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-2.5 py-1 font-sans text-[0.7rem] font-medium text-accent"
                >
                  <SourceChip domain={b.domain} size="xs" />
                  {b.label}
                </span>
              ))}
            </div>
          )}

          {/* The verdict is the product. */}
          <p className="mt-4 border-l-4 border-accent pl-3 font-serif text-[1.3rem] font-semibold leading-snug tracking-tight">
            {analysis.verdict}
          </p>

          {v && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {v.price_tier && <Chip icon={Wallet}>{v.price_tier}</Chip>}
              {v.booking_difficulty && (
                <Chip icon={Ticket}>{v.booking_difficulty}</Chip>
              )}
              {v.busiest && <Chip icon={Users}>Busiest {v.busiest}</Chip>}
              {v.best_time_to_try && (
                <Chip icon={Clock}>Best {v.best_time_to_try}</Chip>
              )}
              {v.reservation_route && (
                <Chip icon={CalendarClock}>{v.reservation_route}</Chip>
              )}
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2 border-y border-rule py-3 text-center">
            <div>
              <p className="font-serif text-xl font-semibold">{reviews.length}</p>
              <p className="font-sans text-[0.6rem] uppercase tracking-widest text-muted">
                evidence
              </p>
            </div>
            <div>
              <p className="font-serif text-xl font-semibold">
                {avg === null ? "—" : `${avg.toFixed(1)}★`}
              </p>
              <p className="font-sans text-[0.6rem] uppercase tracking-widest text-muted">
                avg rating
              </p>
            </div>
            <div>
              <p className="font-serif text-xl font-semibold capitalize">
                {social?.buzz_level ?? "—"}
              </p>
              <p className="font-sans text-[0.6rem] uppercase tracking-widest text-muted">
                buzz
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1">
            {provenance.slice(0, 7).map((d) => (
              <SourceChip key={d} domain={d} size="xs" />
            ))}
          </div>
        </header>

        {/* ================= DINER ================= */}
        {mode === "diner" && diner && (
          <div className="mt-6 space-y-6">
            <section className="print-block border-l-4 border-accent bg-accent-soft/60 px-4 py-4">
              <Label>Should you go</Label>
              <p className="mt-2 font-serif text-lg leading-snug">
                {diner.should_you_go}
              </p>
            </section>

            {diner.order_this?.length > 0 && (
              <section className="print-block">
                <Label>Order this</Label>
                <div className="mt-2 space-y-1.5">
                  {diner.order_this.map((d, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-rule bg-paper px-3 py-2 font-serif text-[0.95rem]"
                    >
                      {d}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {diner.skip_this?.length > 0 && (
              <section className="print-block">
                <Label>Skip</Label>
                <div className="mt-2 space-y-1.5">
                  {diner.skip_this.map((d, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-rule bg-white px-3 py-2 font-serif text-[0.95rem] text-muted line-through decoration-accent/40"
                    >
                      {d}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="print-block">
              <Label>Getting in</Label>
              <p className="mt-2 font-sans text-[0.9rem] leading-relaxed">
                {diner.getting_in}
              </p>
              {diner.go_when && (
                <p className="mt-2">
                  <Chip icon={Clock}>Go {diner.go_when}</Chip>
                </p>
              )}
            </section>

            {diner.know_before?.length > 0 && (
              <section className="print-block border border-rule bg-paper px-4 py-3">
                <Label>Know before you go</Label>
                <ul className="mt-2 space-y-1.5">
                  {diner.know_before.map((k, i) => (
                    <li
                      key={i}
                      className="font-sans text-[0.85rem] leading-snug text-ink"
                    >
                      — {k}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {/* ================= OWNER ================= */}
        {mode === "owner" && (
          <div className="mt-5 space-y-5">
            {/* THE ONE FIX */}
            <section className="print-block border-l-4 border-accent bg-accent-soft/60 px-4 py-4">
              <Label>The one fix</Label>
              <h2 className="mt-2 font-serif text-[1.4rem] font-semibold leading-tight tracking-tight">
                {analysis.one_fix.action}
              </h2>
              <p className="mt-2 line-clamp-2 font-sans text-[0.85rem] leading-relaxed text-muted">
                {analysis.one_fix.why_this_one}
              </p>
              <Disclosure label="why this one">
                <p className="mt-1 font-sans text-[0.85rem] leading-relaxed text-muted">
                  {analysis.one_fix.why_this_one}
                </p>
              </Disclosure>
              <Disclosure
                label="receipts"
                count={analysis.one_fix.evidence?.length}
              >
                <Receipts quotes={analysis.one_fix.evidence} />
              </Disclosure>
            </section>

            {/* Charts */}
            <section className="space-y-4">
              <RatingDistribution reviews={reviews} />
              <RatingOverTime reviews={reviews} event={pulseEvent} />
            </section>

            {/* Patterns */}
            <section>
              <Label>Patterns</Label>
              <div className="mt-2 divide-y divide-rule">
                {analysis.patterns.map((p, i) => {
                  const t = TREND[p.trend] ?? TREND.stable;
                  return (
                    <div key={i} className="print-block py-3">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-serif text-[1.05rem] font-semibold leading-snug">
                          {p.title}
                        </h4>
                        <span className={`shrink-0 font-sans text-sm ${t.tone}`}>
                          {t.glyph}
                        </span>
                      </div>
                      <p className="mt-0.5 font-sans text-[0.68rem] uppercase tracking-wider text-muted">
                        {p.category} · {p.frequency}
                      </p>
                      <Disclosure label="receipts" count={p.excerpts?.length}>
                        <Receipts quotes={p.excerpts} />
                        {p.sources?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {p.sources.map((d) => (
                              <SourceChip key={d} domain={d} size="xs" />
                            ))}
                          </div>
                        )}
                      </Disclosure>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* The story — delta + corroboration merged */}
            <section className="print-block border-y-2 border-ink/15 bg-paper px-4 py-3">
              <Label>The story</Label>
              <p className="mt-2 line-clamp-3 font-serif text-[0.95rem] leading-relaxed">
                {analysis.delta}
              </p>
              <Disclosure label="more">
                <p className="mt-1 font-serif text-[0.95rem] leading-relaxed">
                  {analysis.delta}
                </p>
                {analysis.corroboration && (
                  <p className="mt-3 font-serif text-[0.95rem] leading-relaxed">
                    <span className="font-semibold">Second opinion · </span>
                    {analysis.corroboration}
                  </p>
                )}
                {pulseEvent && (
                  <p className="mt-3 border-l-2 border-accent pl-3 font-sans text-[0.8rem] text-muted">
                    <span className="font-semibold text-accent">Likely cause · </span>
                    {pulseEvent.finding}{" "}
                    <span className="text-muted/70">({pulseEvent.date})</span>
                  </p>
                )}
              </Disclosure>
            </section>

            {/* Voices */}
            {analysis.key_reviews?.length > 0 && (
              <section className="print-block">
                <Label>Voices</Label>
                {/* Horizontal strip: all three stay visible at one card's height. */}
                <div className="-mx-1 mt-2 flex snap-x gap-2 overflow-x-auto px-1 pb-1 print:flex-col print:overflow-visible">
                  {analysis.key_reviews.map((k, i) => (
                    <div
                      key={i}
                      className="w-56 shrink-0 snap-start border border-rule bg-paper p-3 print:w-auto"
                    >
                      <p className="font-sans text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-accent">
                        {WHY[k.why_chosen] ?? k.why_chosen}
                      </p>
                      <p className="mt-1 line-clamp-4 font-serif text-[0.85rem] italic leading-snug print:line-clamp-none">
                        “{clean(k.quote)}”
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {typeof k.stars === "number" && (
                          <span className="font-sans text-[0.78rem] text-accent">
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

            {/* Bright spots — headline visible, the rest on demand */}
            {analysis.bright_spots?.length > 0 && (
              <section className="print-block">
                <Label>Bright spots</Label>
                <p className="mt-1 line-clamp-2 font-serif text-[0.95rem] font-semibold leading-snug">
                  {analysis.bright_spots[0].finding}
                </p>
                <Disclosure
                  label={
                    analysis.bright_spots.length > 1
                      ? `all ${analysis.bright_spots.length}`
                      : "receipts"
                  }
                >
                  {analysis.bright_spots.map((b, i) => (
                    <div key={i} className="mt-2">
                      <p className="font-serif text-[0.95rem] font-semibold leading-snug">
                        {b.finding}
                      </p>
                      <Receipts quotes={b.excerpts} />
                    </div>
                  ))}
                </Disclosure>
              </section>
            )}

            {/* Behind disclosure: heat, stats, replies */}
            <section>
              <Disclosure label="what people talk about">
                <MentionHeat reviews={reviews} />
              </Disclosure>

              {contextStats.length > 0 && (
                <Disclosure label="why this matters">
                  <ul className="mt-2 space-y-1.5">
                    {contextStats.slice(0, 3).map((s, i) => (
                      <li
                        key={i}
                        className="font-sans text-[0.78rem] leading-relaxed text-muted"
                      >
                        {s.stat}{" "}
                        <span className="italic text-muted/70">— {s.source}</span>
                      </li>
                    ))}
                  </ul>
                </Disclosure>
              )}

              <Disclosure label="suggested replies" count={replies?.length}>
                {repliesError && (
                  <div className="no-print mt-2 font-sans text-[0.78rem] text-accent">
                    {repliesError}{" "}
                    <button
                      onClick={onRetryReplies}
                      className="underline underline-offset-4"
                    >
                      Retry
                    </button>
                  </div>
                )}
                {!replies && !repliesError && (
                  <p className="mt-2 font-sans text-[0.78rem] text-muted">
                    Drafting replies…
                  </p>
                )}
                {replies?.map((r, i) => (
                  <div key={i} className="print-block mt-3">
                    <p className="font-serif text-[0.78rem] italic text-muted">
                      Re: “{r.review_excerpt}…”
                    </p>
                    <p className="mt-1 font-serif text-[0.9rem] leading-relaxed">
                      {r.reply}
                    </p>
                  </div>
                ))}
              </Disclosure>
            </section>
          </div>
        )}

        {/* ---------- Footer ---------- */}
        <footer className="no-print mt-8 flex items-center justify-between border-t border-rule pt-4">
          <p className="font-sans text-[0.68rem] text-muted">
            {reviews.length} evidence · {provenance.length} sources
            {range.from ? ` · ${range.label}` : ""}
          </p>
          <div className="flex gap-2">
            {onAsk && (
              <button
                onClick={onAsk}
                className="flex items-center gap-1.5 rounded-md border border-ink/20 px-3 py-1.5 font-sans text-[0.75rem]"
              >
                <MessageCircle size={13} /> Ask
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-md border border-ink/20 px-3 py-1.5 font-sans text-[0.75rem]"
            >
              <Printer size={13} /> Print
            </button>
          </div>
        </footer>
      </div>
    </article>
  );
}
