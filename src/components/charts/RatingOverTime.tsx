import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ParsedReview } from "../../types";
import { bucketKeyFor, bucketModeFor, ratingOverTime } from "../../lib/stats";
import type { PulseEvent } from "../../lib/stats";

/** Two points is a line through noise. Three is the minimum shape worth drawing. */
const MIN_BUCKETS = 3;

const TERRACOTTA = "#9c3b23";
const MUTED = "#6b6560";
const RULE = "#ddd6cc";

const MAX_EVENT_LABEL = 28;

function truncate(s: string, max = MAX_EVENT_LABEL): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Average rating over time. Renders nothing below MIN_BUCKETS periods — with
 * one or two points there is no trend, only two numbers, and a line between
 * them would invent a direction.
 */
export default function RatingOverTime({
  reviews,
  event,
}: {
  reviews: ParsedReview[];
  event?: PulseEvent | null;
}) {
  const buckets = ratingOverTime(reviews);
  if (buckets.length < MIN_BUCKETS) return null;

  const mode = bucketModeFor(reviews);
  const n = buckets.reduce((sum, b) => sum + b.n, 0);
  const period = mode === "month" ? "month" : "quarter";

  // Only annotate when the event actually lands on a plotted bucket — an event
  // outside the window would otherwise be pinned to an edge and read as causal.
  const eventKey = event ? bucketKeyFor(event.date, mode) : null;
  const eventIndex = eventKey ? buckets.findIndex((b) => b.bucket === eventKey) : -1;
  const eventBucket = eventIndex >= 0 ? buckets[eventIndex] : null;
  const labelPosition =
    eventIndex > buckets.length - 2 ? "insideTopRight" : "insideTopLeft";

  return (
    <figure className="print-block m-0">
      <figcaption className="font-serif text-lg font-semibold tracking-tight text-ink">
        Rating over time
      </figcaption>

      <div className="mt-3" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={buckets}
            margin={{ top: 18, right: 12, bottom: 4, left: -18 }}
          >
            <defs>
              <linearGradient id="ratingOverTimeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TERRACOTTA} stopOpacity={0.22} />
                <stop offset="100%" stopColor={TERRACOTTA} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke={RULE} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={{ stroke: RULE }}
              tickLine={false}
              tick={{ fill: MUTED, fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              domain={[1, 5]}
              ticks={[1, 2, 3, 4, 5]}
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fill: MUTED, fontSize: 11 }}
              width={40}
            />
            <Tooltip
              cursor={{ stroke: RULE, strokeWidth: 1 }}
              formatter={(value, _name, item) => {
                const count =
                  (item as { payload?: { n?: number } } | undefined)?.payload?.n ?? 0;
                return [`${value ?? "—"} avg · ${count} reviews`, ""];
              }}
              contentStyle={{
                border: `1px solid ${RULE}`,
                borderRadius: 4,
                fontSize: 12,
                color: "#1c1a17",
              }}
            />

            {eventBucket ? (
              <ReferenceLine
                x={eventBucket.label}
                stroke={MUTED}
                strokeDasharray="3 3"
                label={{
                  value: truncate(event?.finding ?? ""),
                  position: labelPosition,
                  fill: MUTED,
                  fontSize: 10,
                }}
              />
            ) : null}

            <Area
              type="monotone"
              dataKey="avg"
              stroke={TERRACOTTA}
              strokeWidth={2}
              fill="url(#ratingOverTimeFill)"
              dot={{ r: 3, fill: TERRACOTTA, stroke: "#fff", strokeWidth: 2 }}
              activeDot={{ r: 5, fill: TERRACOTTA, stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-1 text-xs text-muted">
        Average rating by {period} · {n} rated reviews with dates
      </p>
    </figure>
  );
}
