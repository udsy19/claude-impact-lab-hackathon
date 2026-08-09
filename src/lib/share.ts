import { toPng } from "html-to-image";
import { db } from "../db";
import type { DossierRow, Restaurant } from "../db/types";

/**
 * The share card is the growth loop, so it has to survive being pasted into a
 * group chat: real OG tags, a real 1200x630 image, and a link that opens fast.
 */

export function shareUrl(slug: string): string {
  return `${window.location.origin}/r/${slug}`;
}

/** Renders the hidden 1200x630 node to a PNG data URL. */
export async function renderCardImage(node: HTMLElement): Promise<string | null> {
  try {
    return await toPng(node, {
      width: 1200,
      height: 630,
      pixelRatio: 1,
      cacheBust: true,
      skipFonts: false,
    });
  } catch {
    return null; // a missing image degrades the unfurl, not the link
  }
}

export async function createShare(
  d: DossierRow,
  image?: string | null,
): Promise<string> {
  const card = await db.createShareCard(d.id, image ?? null);
  return shareUrl(card.slug);
}

export async function nativeShare(
  r: Restaurant,
  d: DossierRow,
  url: string,
): Promise<"shared" | "copied"> {
  const text = `vetted: ${r.name}. ${d.verdict ?? ""}`.trim();
  if (navigator.share) {
    try {
      await navigator.share({ title: `${r.name} — verified`, text, url });
      return "shared";
    } catch {
      // user dismissed the sheet, or the browser refused — fall through
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
  } catch {
    /* clipboard blocked; the URL is still on screen */
  }
  return "copied";
}

/**
 * OG tags are set at runtime because this is a SPA with no SSR. Real crawlers
 * (iMessage, Slack, Twitter) do not execute JS, so this only helps in-app
 * previews — the static fallback tags in index.html carry the rest. Noted in
 * README as the one thing a tiny SSR layer would genuinely improve.
 */
export function setOgTags(opts: {
  title: string;
  description: string;
  image?: string | null;
  url: string;
}): void {
  const set = (attr: "property" | "name", key: string, value: string) => {
    let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", value);
  };
  document.title = opts.title;
  set("property", "og:title", opts.title);
  set("property", "og:description", opts.description);
  set("property", "og:url", opts.url);
  set("property", "og:type", "website");
  set("name", "twitter:card", "summary_large_image");
  set("name", "twitter:title", opts.title);
  set("name", "twitter:description", opts.description);
  if (opts.image) {
    set("property", "og:image", opts.image);
    set("name", "twitter:image", opts.image);
  }
}
