import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import { db } from "../db";
import { randomSlug } from "./geo";
import { OG_HEIGHT, OG_WIDTH, OgCard } from "./ogCard";
import type { DossierRow, Restaurant } from "../db/types";

/**
 * The share card is the growth loop, so it has to survive being pasted into a
 * group chat: real OG tags, a real 1200x630 image, and a link that opens fast.
 *
 * FAILURE POLICY
 * --------------
 * Everything on the image path — rendering the card, uploading it, even reading
 * the restaurant back — is best effort and returns null on failure. A share
 * that unfurls as a bare link is a worse share; a share button that throws is
 * no share at all. Nothing below is allowed to reject into `createShare`.
 */

/** Public storage bucket the PNGs live in. See supabase/functions/README.md. */
const OG_BUCKET = "og";

/** Card render + upload is a nice-to-have; it never delays a share this long. */
const IMAGE_BUDGET_MS = 8000;

function readEnv(key: string): string {
  const env = import.meta.env as Record<string, unknown> | undefined;
  const value = env?.[key];
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

export function shareUrl(slug: string): string {
  return `${window.location.origin}/r/${slug}`;
}

/**
 * The URL we actually hand to the share sheet. `/r/<slug>` is client-rendered,
 * so its meta tags are written by JS that iMessage, Slack, Twitter, WhatsApp
 * and Discord never run. The edge function serves the same card as static HTML
 * with real OG tags and bounces humans on to the SPA.
 *
 * Without Supabase configured there is no function to call, so we fall back to
 * the plain SPA route — link still works, unfurl is just generic.
 */
export function ogFunctionUrl(slug: string): string {
  const base = readEnv("VITE_SUPABASE_URL");
  if (!base) return shareUrl(slug);
  return `${base}/functions/v1/og?slug=${encodeURIComponent(slug)}`;
}

/** Renders the hidden 1200x630 node to a PNG data URL. */
export async function renderCardImage(node: HTMLElement): Promise<string | null> {
  try {
    return await toPng(node, {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      pixelRatio: 1,
      cacheBust: true,
      skipFonts: false,
    });
  } catch {
    return null; // a missing image degrades the unfurl, not the link
  }
}

/**
 * Mounts <OgCard> off-screen, rasterises it, and tears it down again.
 *
 * Off-screen rather than `display: none` on purpose: a hidden subtree has no
 * layout, and html-to-image would capture a 0x0 clone. It has to be painted
 * somewhere the user cannot see it instead.
 */
export async function renderOgCardImage(
  restaurant: Restaurant,
  dossier: DossierRow,
): Promise<string | null> {
  if (typeof document === "undefined") return null;

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${OG_WIDTH}px;height:${OG_HEIGHT}px;pointer-events:none;opacity:0;z-index:-1;`;
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    // flushSync forces a synchronous commit; the concurrent default would let
    // us reach toPng before anything had actually been painted.
    flushSync(() => root.render(createElement(OgCard, { restaurant, dossier })));
    // Fraunces arrives over the network; capturing first bakes in the fallback.
    await document.fonts?.ready?.catch?.(() => {});
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const child = host.firstElementChild as HTMLElement | null;
    return await renderCardImage(child ?? host);
  } catch {
    return null;
  } finally {
    // Unmounting inside the same tick as a render warns in React 19.
    setTimeout(() => {
      root.unmount();
      host.remove();
    }, 0);
  }
}

/**
 * Uploads a PNG data URL to the public `og` bucket and returns its public URL.
 *
 * Uses the storage REST API with the anon key rather than supabase-js so this
 * stays a single fetch with no client construction. The bucket must be public
 * and must allow anon inserts (see supabase/functions/README.md); if it does
 * not exist yet this returns null and the share proceeds without an image.
 */
export async function uploadOgImage(
  dataUrl: string,
  slug: string,
): Promise<string | null> {
  const base = readEnv("VITE_SUPABASE_URL");
  const key = readEnv("VITE_SUPABASE_ANON_KEY");
  if (!base || !key || !dataUrl.startsWith("data:image/")) return null;

  const path = `${encodeURIComponent(slug)}.png`;

  try {
    const blob = await (await fetch(dataUrl)).blob();
    const res = await fetch(`${base}/storage/v1/object/${OG_BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "image/png",
        "cache-control": "public, max-age=31536000",
        "x-upsert": "true",
      },
      body: blob,
    });
    if (!res.ok) {
      console.warn(`[share] og upload failed: ${res.status}`);
      return null;
    }
    return `${base}/storage/v1/object/public/${OG_BUCKET}/${path}`;
  } catch (e) {
    console.warn(`[share] og upload failed: ${(e as Error)?.message ?? e}`);
    return null;
  }
}

function withBudget<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), ms)),
  ]);
}

/**
 * Renders and uploads the unfurl image for a dossier. Returns the public URL,
 * or null for any reason at all.
 *
 * The image key is generated here rather than reusing the card slug because
 * `share_cards` has an INSERT policy and no UPDATE policy for anon — the row
 * cannot be patched after creation, so `og_image` has to be known *before* the
 * card exists, and therefore before its slug does.
 */
async function buildOgImage(dossier: DossierRow): Promise<string | null> {
  try {
    const restaurant = await db.restaurantById(dossier.restaurant_id);
    if (!restaurant) return null;
    const dataUrl = await renderOgCardImage(restaurant, dossier);
    if (!dataUrl) return null;
    return await uploadOgImage(dataUrl, randomSlug(12));
  } catch {
    return null;
  }
}

/**
 * Creates a share card and returns the crawler-friendly URL to send.
 *
 * `image` may be an already-rendered data URL (uploaded, never stored raw — a
 * data URL in a text column is a megabyte of base64 no crawler will read) or
 * an already-hosted URL. Omit it and the card is rendered here.
 */
export async function createShare(
  d: DossierRow,
  image?: string | null,
): Promise<string> {
  let ogImage: string | null = null;

  if (image?.startsWith("data:")) {
    ogImage = await withBudget(uploadOgImage(image, randomSlug(12)), IMAGE_BUDGET_MS);
  } else if (image) {
    ogImage = image;
  } else {
    ogImage = await withBudget(buildOgImage(d), IMAGE_BUDGET_MS);
  }

  const card = await db.createShareCard(d.id, ogImage);
  return ogFunctionUrl(card.slug);
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
 * Runtime OG tags for in-app previews and any crawler that does run JS. Real
 * crawlers (iMessage, Slack, Twitter) do not, which is what the `og` edge
 * function in supabase/functions/og exists to solve — shared links point at it,
 * not at this page.
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
