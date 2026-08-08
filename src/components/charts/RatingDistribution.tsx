import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ParsedReview } from "../../types";
import { ratedCount, ratingDistribution } from "../../lib/stats";

/** Below this many rated reviews the shape of the distribution is noise. */
const MIN_RATED = 10;

const TERRACOTTA = "#9c3b23"; // 4-5★
const MUTED = "#6b6560"; // 3★
const CHARCOAL = "#1c1a17"; // 1-2★

function barColor(star: number): string {
  if (star >= 4) return TERRACOTTA;
  if (star === 3) return MUTED;
  return CHARCOAL;
}

const GLYPHS: Record<number, string> = {
  5: "★★★★★",
  4: "★★★★☆",
  3: "★★★☆☆",
  2: "★★☆☆☆",
  1: "★☆☆☆☆",
};

interface Row {
  star: number;
  count: number;
  pct: number;
  glyph: string;
}

/**
 * Horizontal star distribution. Renders nothing at all below MIN_RATED rated
 * reviews — a five-bar chart drawn from six ratings implies a precision the
 * evidence does not have.
 */
export default function RatingDistribution({ reviews }: { reviews: ParsedReview[] }) {
  const n = ratedCount(reviews);
  if (n < MIN_RATED) return null;

  const rows: Row[] = ratingDistribution(reviews).map((r) => ({
    ...r,
    glyph: GLYPHS[r.star] ?? `${r.star}★`,
  }));
  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <figure className="print-block m-0">
      <figcaption className="font-serif text-lg font-semibold tracking-tight text-ink">
        Star distribution
      </figcaption>

      <div className="mt-3" style={{ height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 64, bottom: 4, left: 0 }}
            barCategoryGap="22%"
          >
            <XAxis type="number" domain={[0, max]} hide />
            <YAxis
              type="category"
              dataKey="glyph"
              width={76}
              axisLine={false}
              tickLine={false}
              tick={{ fill: MUTED, fontSize: 13, letterSpacing: "0.06em" }}
            />
            <Tooltip
              cursor={{ fill: "rgba(28,26,23,0.04)" }}
              formatter={(value, _name, item) => {
                const n = Number(value) || 0;
                const pct = (item as { payload?: Row } | undefined)?.payload?.pct ?? 0;
                return [`${n} review${n === 1 ? "" : "s"} · ${pct}%`, ""];
              }}
              labelFormatter={(label) => String(label)}
              contentStyle={{
                border: "1px solid #ddd6cc",
                borderRadius: 4,
                fontSize: 12,
                color: "#1c1a17",
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.star} fill={barColor(r.star)} />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                offset={10}
                style={{ fill: "#1c1a17", fontSize: 12, fontWeight: 600 }}
                formatter={(v) => String(v ?? "")}
              />
              <LabelList
                dataKey="pct"
                position="right"
                offset={34}
                style={{ fill: "#6b6560", fontSize: 12 }}
                formatter={(v) => `${v ?? 0}%`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-1 text-xs text-muted">Based on {n} rated reviews</p>
    </figure>
  );
}
