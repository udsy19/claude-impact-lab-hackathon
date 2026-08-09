import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clock,
  MessageCircle,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import SourceChip from "../components/SourceChip";
import Disclosure from "../components/Disclosure";
import AskDrawer from "../components/AskDrawer";
import Engine from "./Engine";
import { db } from "../db";
import { buildDossier, getDossier } from "../dossier/service";
import { createShare, nativeShare } from "../lib/share";
import { initialState, reducer } from "../swarm/reducer";
import type { DossierRow, Health, Restaurant } from "../db/types";
import type { SwarmState } from "../types";

interface Vitals {
  price_tier?: string | null;
  booking_difficulty?: string | null;
  busiest?: string | null;
  best_time_to_try?: string | null;
  reservation_route?: string | null;
}
interface DinerView {
  should_you_go?: string;
  order_this?: string[];
  skip_this?: string[];
  getting_in?: string;
  know_before?: string[];
  go_when?: string | null;
}
interface Pattern {
  title: string;
  frequency?: string;
  excerpts?: string[];
  sources?: string[];
}
interface KeyReview {
  quote: string;
  source?: string;
  stars?: number | null;
  why_chosen?: string;
}

const clean = (q: string) => q.replace(/^["“]|["”]$/g, "").trim();

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
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-white px-2.5 py-1 font-sans text-[0.7rem]">
      <Icon size={12} className="text-muted" />
      {children}
    </span>
  );
}

/** Only ever rendered on a confident match — a wrong grade is the worst bug. */
function HealthBlock({ health }: { health: Health | null }) {
  if (!health || health.status !== "matched") return null;
  const bad = health.critical_violations.length > 0;
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        bad ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"
      }`}
    >
      <p
        className={`flex items-center gap-1.5 font-sans text-[0.8rem] font-medium ${
          bad ? "text-amber-900" : "text-emerald-900"
        }`}
      >
        {bad ? <ShieldAlert size={13} /> : <ShieldCheck size={13} />}
        health inspection
        {health.grade ? ` · grade ${health.grade}` : ""}
        {health.score != null ? ` · score ${health.score}` : ""}
      </p>
      {health.inspected_at && (
        <p className="mt-0.5 font-sans text-[0.7rem] text-muted">
          last inspected {new Date(health.inspected_at).toLocaleDateString()}
        </p>
      )}
      {bad && (
        <ul className="mt-1.5 space-y-0.5">
          {health.critical_violations.slice(0, 3).map((v, i) => (
            <li key={i} className="font-sans text-[0.78rem] text-amber-900">
              — {v}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 font-sans text-[0.64rem] text-muted">
        source: {health.source}
      </p>
    </div>
  );
}

export default function DossierView({ restaurant }: { restaurant: Restaurant }) {
  const [dossier, setDossier] = useState<DossierRow | null>(null);
  const [cold, setCold] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [engine, setEngine] = useState<SwarmState>(() =>
    initialState(restaurant.name, restaurant.city ?? ""),
  );
  const [mode, setMode] = useState<"diner" | "owner">("diner");
  const [askOpen, setAskOpen] = useState(false);
  const [shareState, setShareState] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    abort.current?.abort();
    abort.current = new AbortController();

    void (async () => {
      const res = await getDossier(restaurant, { signal: abort.current?.signal });
      if (!alive) return;

      if (res.dossier) {
        setDossier(res.dossier);
        setCold(false);
        if (res.refreshing) {
          setRefreshing(true);
          void res.refreshing.then((d) => {
            if (!alive) return;
            setRefreshing(false);
            if (d) setDossier(d as DossierRow);
          });
        }
        return;
      }

      // Cold: no cache exists. This is the only path that shows the engine.
      setCold(true);
      try {
        const built = await buildDossier(restaurant, {
          signal: abort.current?.signal,
          onEvent: (e) => setEngine((s) => reducer(s, e)),
        });
        if (!alive) return;
        setDossier(built);
        setCold(false);
      } catch {
        if (alive) setCold(false);
      }
    })();

    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, [restaurant]);

  const share = useCallback(async () => {
    if (!dossier) return;
    setShareState("…");
    try {
      const url = await createShare(dossier, null);
      const how = await nativeShare(restaurant, dossier, url);
      setShareState(how === "copied" ? "link copied" : null);
    } catch {
      setShareState("couldn't create link");
    }
    setTimeout(() => setShareState(null), 2500);
  }, [dossier, restaurant]);

  if (cold) {
    return (
      <div>
        <div className="bg-[#0b0d0f] px-5 pt-6">
          <p className="font-sans text-[0.72rem] text-[#7c8899]">
            first time we've looked at this one. running the check…
          </p>
        </div>
        <Engine state={engine} onOpenPaste={() => {}} />
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="px-6 py-20 text-center font-sans text-muted">
        couldn't build a dossier for {restaurant.name}.
      </div>
    );
  }

  const v = (dossier.vitals ?? null) as Vitals | null;
  const dv = (dossier.diner_view ?? null) as DinerView | null;
  const patterns = (dossier.patterns ?? []) as Pattern[];
  const keyReviews = (dossier.key_reviews ?? []) as KeyReview[];
  const badges = (dossier.badges ?? []) as { label: string; domain?: string }[];

  return (
    <article className="bg-white">
      {dv && (
        <div className="sticky top-[41px] z-10 flex gap-1 border-b border-rule bg-white/95 p-2 backdrop-blur">
          {(["diner", "owner"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md py-1.5 font-sans text-[0.75rem] font-medium capitalize ${
                mode === m ? "bg-accent text-white" : "bg-paper text-muted"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      <div className="px-5 py-5">
        {/* At a glance */}
        <header>
          <h1 className="font-serif text-[1.75rem] font-semibold leading-tight tracking-tight">
            {restaurant.name}
          </h1>
          <p className="font-sans text-[0.75rem] text-muted">
            {[restaurant.neighborhood, restaurant.city].filter(Boolean).join(", ")}
            {refreshing && <span className="ml-2 animate-pulse">· refreshing</span>}
          </p>

          {badges.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {badges.map((b, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-2.5 py-1 font-sans text-[0.7rem] font-medium text-accent"
                >
                  {b.domain && <SourceChip domain={b.domain} size="xs" />}
                  {b.label}
                </span>
              ))}
            </div>
          )}

          <p className="mt-4 border-l-4 border-accent pl-3 font-serif text-[1.3rem] font-semibold leading-snug">
            {dossier.verdict}
          </p>

          {v && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {v.price_tier && <Chip icon={Wallet}>{v.price_tier}</Chip>}
              {v.booking_difficulty && <Chip icon={Ticket}>{v.booking_difficulty}</Chip>}
              {v.busiest && <Chip icon={Users}>busiest {v.busiest}</Chip>}
              {v.best_time_to_try && <Chip icon={Clock}>best {v.best_time_to_try}</Chip>}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-1">
            {dossier.sources.slice(0, 8).map((s) => (
              <SourceChip key={s} domain={s} size="xs" />
            ))}
          </div>
        </header>

        {/* DINER (default) */}
        {mode === "diner" && dv && (
          <div className="mt-6 space-y-5">
            {dv.should_you_go && (
              <section className="border-l-4 border-accent bg-accent-soft/60 px-4 py-4">
                <Label>should you go</Label>
                <p className="mt-2 font-serif text-lg leading-snug">
                  {dv.should_you_go}
                </p>
              </section>
            )}

            {!!dv.order_this?.length && (
              <section>
                <Label>order this</Label>
                <div className="mt-2 space-y-1.5">
                  {dv.order_this.map((d, i) => (
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

            {!!dv.skip_this?.length && (
              <section>
                <Label>skip</Label>
                <div className="mt-2 space-y-1.5">
                  {dv.skip_this.map((d, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-rule px-3 py-2 font-serif text-[0.95rem] text-muted line-through decoration-accent/40"
                    >
                      {d}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* know-before: health lives here, plainly */}
            <section className="space-y-2">
              <Label>know before you go</Label>
              <HealthBlock health={dossier.health} />
              {dv.know_before?.map((k, i) => (
                <p key={i} className="font-sans text-[0.85rem] leading-snug">
                  — {k}
                </p>
              ))}
            </section>

            {dv.getting_in && (
              <section>
                <Label>getting in</Label>
                <p className="mt-2 font-sans text-[0.9rem] leading-relaxed">
                  {dv.getting_in}
                </p>
                {dv.go_when && (
                  <p className="mt-2">
                    <Chip icon={Clock}>go {dv.go_when}</Chip>
                  </p>
                )}
              </section>
            )}

            {keyReviews.length > 0 && (
              <section>
                <Label>voices</Label>
                <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
                  {keyReviews.map((k, i) => (
                    <div
                      key={i}
                      className="w-56 shrink-0 border border-rule bg-paper p-3"
                    >
                      <p className="line-clamp-4 font-serif text-[0.85rem] italic leading-snug">
                        “{clean(k.quote)}”
                      </p>
                      {k.source && (
                        <div className="mt-2">
                          <SourceChip domain={k.source} size="xs" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* OWNER */}
        {mode === "owner" && (
          <div className="mt-6 space-y-5">
            <section>
              <Label>patterns</Label>
              <div className="mt-2 divide-y divide-rule">
                {patterns.map((p, i) => (
                  <div key={i} className="py-2.5">
                    <h4 className="font-serif text-[1.05rem] font-semibold leading-snug">
                      {p.title}
                    </h4>
                    {p.frequency && (
                      <p className="mt-0.5 font-sans text-[0.68rem] uppercase tracking-wider text-muted">
                        {p.frequency}
                      </p>
                    )}
                    {!!p.excerpts?.length && (
                      <Disclosure label="receipts" count={p.excerpts.length}>
                        <ul className="mt-2 space-y-2">
                          {p.excerpts.map((q, j) => (
                            <li key={j} className="border-l-2 border-rule pl-3">
                              <p className="font-serif text-[0.85rem] italic leading-snug text-muted">
                                “{clean(q)}”
                              </p>
                              {p.sources?.[j] && (
                                <span className="mt-1 inline-block">
                                  <SourceChip domain={p.sources[j]} size="xs" />
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </Disclosure>
                    )}
                  </div>
                ))}
              </div>
            </section>
            <a
              href={`/claim/${restaurant.slug}`}
              className="block text-center font-sans text-[0.78rem] text-accent underline underline-offset-4"
            >
              own this place? claim your brief
            </a>
          </div>
        )}

        <footer className="mt-8 flex items-center justify-between border-t border-rule pt-4">
          <p className="font-sans text-[0.68rem] text-muted">
            {dossier.evidence_count} evidence · {dossier.sources.length} sources
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setAskOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-ink/20 px-3 py-1.5 font-sans text-[0.75rem]"
            >
              <MessageCircle size={13} /> ask
            </button>
            <button
              onClick={() => void share()}
              className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 font-sans text-[0.75rem] text-white"
            >
              <Share2 size={13} /> {shareState ?? "share"}
            </button>
          </div>
        </footer>
      </div>

      <AskDrawer
        open={askOpen}
        onClose={() => setAskOpen(false)}
        restaurant={restaurant.name}
        evidence={JSON.stringify(dossier.evidence.slice(0, 80))}
        brief={JSON.stringify({
          verdict: dossier.verdict,
          vitals: v,
          diner_view: dv,
          health: dossier.health,
        })}
      />
    </article>
  );
}

/** Kept for callers that want to warm a dossier without rendering it. */
export async function prefetchDossier(r: Restaurant): Promise<void> {
  const existing = await db.dossierFor(r.id);
  if (!existing) await buildDossier(r).catch(() => {});
}
