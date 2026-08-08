import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ParsedReview } from "../../types";
import { mentionHeat } from "../../lib/stats";

const TERRACOTTA = "#9c3b23"; // spoken of well
const RULE = "#ddd6cc"; // mentioned, sentiment unclear
const CHARCOAL = "#1c1a17"; // spoken of badly
const MUTED = "#6b6560";

const LABEL: Record<string, string> = {
  service: "Service",
  food: "Food",
  pacing: "Pacing",
  pricing: "Pricing",
  staffing: "Staffing",
  ambience: "Ambience",
  consistency: "Consistency",
};

interface Row {
  category: string;
  name: string;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

const SERIES = [
  { key: "positive", label: "Positive", color: TERRACOTTA },
  { key: "neutral", label: "Unclear", color: RULE },
  { key: "negative", label: "Negative", color: CHARCOAL },
] as const;

/**
 * What the reviews are actually about. Categories nobody mentioned never appear,
 * and the "unclear" band keeps the bar honest: its length is total mentions, not
 * just the ones we could confidently score.
 */
export default function MentionHeat({ reviews }: { reviews: ParsedReview[] }) {
  const rows: Row[] = mentionHeat(reviews).map((r) => ({
    category: r.category,
    name: LABEL[r.category] ?? r.category,
    positive: r.positive,
    negative: r.negative,
    neutral: Math.max(0, r.total - r.positive - r.negative),
    total: r.total,
  }));
  if (rows.length === 0) return null;

  const height = Math.max(96, rows.length * 30 + 8);

  return (
    <figure className="print-block m-0">
      <figcaption className="font-serif text-lg font-semibold tracking-tight text-ink">
        What people actually talk about
      </figcaption>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ background: s.color, boxShadow: `inset 0 0 0 1px ${RULE}` }}
            />
            {s.label}
          </span>
        ))}
      </div>

      <div className="mt-2" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 2, right: 40, bottom: 2, left: 0 }}
            barCategoryGap="28%"
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={92}
              axisLine={false}
              tickLine={false}
              tick={{ fill: MUTED, fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "rgba(28,26,23,0.04)" }}
              formatter={(value, name) => [String(value ?? 0), String(name ?? "")]}
              contentStyle={{
                border: `1px solid ${RULE}`,
                borderRadius: 4,
                fontSize: 12,
                color: "#1c1a17",
              }}
            />

            <Bar
              dataKey="positive"
              name="Positive"
              stackId="m"
              fill={TERRACOTTA}
              radius={[4, 0, 0, 4]}
              stroke="#fff"
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Bar
              dataKey="neutral"
              name="Unclear"
              stackId="m"
              fill={RULE}
              stroke="#fff"
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Bar
              dataKey="negative"
              name="Negative"
              stackId="m"
              fill={CHARCOAL}
              radius={[0, 4, 4, 0]}
              stroke="#fff"
              strokeWidth={2}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="total"
                position="right"
                offset={10}
                style={{ fill: "#1c1a17", fontSize: 12, fontWeight: 600 }}
                formatter={(v) => String(v ?? "")}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-1 text-xs text-muted">
        Reviews mentioning each topic · a review can count in more than one
      </p>
    </figure>
  );
}
