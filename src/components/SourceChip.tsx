import { useState } from "react";
import { Globe } from "lucide-react";

export function favicon(domain: string, size = 64): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    domain,
  )}&sz=${size}`;
}

const LABEL: Record<string, string> = {
  "guide.michelin.com": "Michelin Guide",
  "jamesbeard.org": "James Beard",
  "theinfatuation.com": "The Infatuation",
  "sfchronicle.com": "SF Chronicle",
  "sf.eater.com": "Eater SF",
  "paloaltoonline.com": "Palo Alto Online",
  "mercurynews.com": "Mercury News",
  pasted: "pasted by owner",
};

export function sourceLabel(domain: string): string {
  return LABEL[domain] ?? domain.replace(/^www\./, "");
}

export default function SourceChip({
  domain,
  size = "sm",
  dark = false,
}: {
  domain: string;
  size?: "xs" | "sm" | "md";
  dark?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const px = size === "xs" ? 12 : size === "md" ? 20 : 14;
  const text =
    size === "xs" ? "text-[0.65rem]" : size === "md" ? "text-sm" : "text-xs";
  const skin = dark
    ? "border-white/15 bg-white/5 text-slate-300"
    : "border-rule bg-white text-muted";

  if (domain === "pasted") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${text} ${skin}`}
      >
        <Globe size={px} className="opacity-60" />
        {sourceLabel(domain)}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${text} ${skin}`}
      title={domain}
    >
      {broken ? (
        <Globe size={px} className="opacity-60" />
      ) : (
        <img
          src={favicon(domain, 64)}
          alt=""
          width={px}
          height={px}
          loading="lazy"
          onError={() => setBroken(true)}
          className="rounded-[2px]"
        />
      )}
      {sourceLabel(domain)}
    </span>
  );
}
