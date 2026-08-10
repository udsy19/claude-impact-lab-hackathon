/**
 * ogCard.tsx — the 1200x630 node that becomes the unfurl image.
 *
 * Rasterised by `html-to-image` (see renderOgCardImage in lib/share.ts), which
 * clones the node into an SVG foreignObject and draws it to a canvas. Two rules
 * follow from that and neither is negotiable:
 *
 *   1. No external images (favicons, logos, remote avatars). A cross-origin
 *      bitmap taints the canvas and `toPng` returns a blank or throws.
 *   2. Inline styles only — no Tailwind classes, no CSS variables. The clone is
 *      captured with computed styles, and anything resolved from a stylesheet
 *      that fails to inline comes out unstyled.
 *
 * Fonts are declared as a stack ending in a system serif, so the card still
 * looks right if Fraunces hasn't loaded.
 */

import type { DossierRow, Restaurant } from "../db/types";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const PAPER = "#faf8f4";
const INK = "#1c1a17";
const MUTED = "#6b6560";
const RULE = "#ddd6cc";
const ACCENT = "#9c3b23";
const ACCENT_SOFT = "#f3e6e0";

const SERIF =
  '"Fraunces", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif';
const SANS = '-apple-system, "Helvetica Neue", Arial, sans-serif';

/** Long names must not overflow the plate, so the display size steps down. */
function nameSize(name: string): number {
  if (name.length > 34) return 54;
  if (name.length > 22) return 66;
  return 78;
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

function badgeLabels(dossier: DossierRow): string[] {
  return (dossier.badges as { label?: unknown }[] | undefined ?? [])
    .map((b) => (typeof b?.label === "string" ? b.label : ""))
    .filter(Boolean)
    .slice(0, 3);
}

/** `grade A` / `score 94`, or null when we refused to match an inspection. */
function healthChip(dossier: DossierRow): { text: string; alarming: boolean } | null {
  const h = dossier.health;
  if (!h || h.status !== "matched") return null;
  if (!h.grade && h.score == null) return null;
  return {
    text: h.grade ? `health grade ${h.grade}` : `health score ${h.score}`,
    alarming: h.critical_violations.length > 0,
  };
}

function Chip({
  text,
  fg,
  bg,
  border,
}: {
  text: string;
  fg: string;
  bg: string;
  border: string;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "10px 22px",
        marginRight: 14,
        borderRadius: 999,
        border: `1px solid ${border}`,
        backgroundColor: bg,
        color: fg,
        fontFamily: SANS,
        fontSize: 24,
        lineHeight: "28px",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

export function OgCard({
  restaurant,
  dossier,
}: {
  restaurant: Restaurant;
  dossier: DossierRow;
}) {
  const place = [restaurant.neighborhood, restaurant.city].filter(Boolean).join(", ");
  const verdict = truncate(dossier.verdict ?? "Verified by Tablestakes.", 190);
  const badges = badgeLabels(dossier);
  const health = healthChip(dossier);
  const sources = dossier.sources?.length ?? 0;

  return (
    <div
      style={{
        width: OG_WIDTH,
        height: OG_HEIGHT,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        backgroundColor: PAPER,
        color: INK,
        fontFamily: SANS,
        borderLeft: `14px solid ${ACCENT}`,
        overflow: "hidden",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 22,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: ACCENT,
          }}
        >
          verified
        </div>

        <div
          style={{
            marginTop: 14,
            fontFamily: SERIF,
            fontWeight: 600,
            fontSize: nameSize(restaurant.name),
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            maxHeight: 190,
            overflow: "hidden",
          }}
        >
          {restaurant.name}
        </div>

        {place && (
          <div style={{ marginTop: 12, fontFamily: SANS, fontSize: 26, color: MUTED }}>
            {place}
          </div>
        )}

        <div
          style={{
            marginTop: 34,
            paddingLeft: 24,
            borderLeft: `6px solid ${ACCENT}`,
            fontFamily: SERIF,
            fontSize: 38,
            lineHeight: 1.32,
            maxHeight: 160,
            overflow: "hidden",
          }}
        >
          {verdict}
        </div>
      </div>

      <div>
        {(badges.length > 0 || health) && (
          <div style={{ marginBottom: 30, whiteSpace: "nowrap", overflow: "hidden" }}>
            {badges.map((label, i) => (
              <Chip
                key={i}
                text={label}
                fg={ACCENT}
                bg={ACCENT_SOFT}
                border="rgba(156, 59, 35, 0.32)"
              />
            ))}
            {health && (
              <Chip
                text={health.text}
                fg={health.alarming ? "#92400e" : "#065f46"}
                bg={health.alarming ? "#fffbeb" : "#ecfdf5"}
                border={health.alarming ? "#fbbf24" : "#6ee7b7"}
              />
            )}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 24,
            borderTop: `2px solid ${RULE}`,
            fontFamily: SANS,
            fontSize: 22,
            color: MUTED,
          }}
        >
          <span>
            {dossier.evidence_count} pieces of evidence · {sources} sources
          </span>
          <span style={{ color: INK, letterSpacing: "0.06em" }}>
            verified by <span style={{ color: ACCENT, fontWeight: 600 }}>tablestakes</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default OgCard;
