/**
 * og — the crawler-facing half of a share link.
 *
 * `/r/<slug>` is a client-rendered SPA route: `setOgTags()` writes the meta
 * tags after React mounts, which is far too late for iMessage, Slack, Twitter,
 * WhatsApp or Discord — none of them execute JS. They fetch the HTML once, read
 * whatever <meta> is in the bytes, and leave. So a shared link unfurls with the
 * generic fallback title from index.html, which is the growth loop leaking.
 *
 * This function is the fix: it renders real OG tags server-side for a share
 * slug and bounces humans to the SPA with a meta-refresh plus a JS redirect.
 * Crawlers get the tags, people get the app.
 *
 * Deployed at: https://<ref>.supabase.co/functions/v1/og?slug=<slug>
 * Deploy with --no-verify-jwt: crawlers arrive with no Authorization header.
 *
 * Dependency-free on purpose — Deno.serve and fetch against PostgREST, nothing
 * to install, nothing to keep in sync with a version pin.
 */

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};

/** Where the SPA lives. Override with: supabase secrets set SITE_URL=... */
const DEFAULT_SITE_URL = "https://tablestakes.app";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
};

// ------------------------------------------------------------------ escaping

/**
 * Text destined for element content or a double-quoted attribute. A restaurant
 * called Joe's <b>"Diner"</b> must not be able to close a tag or an attribute,
 * and must not be able to open a <script>.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A string literal safe inside <script>: JSON, with `<` neutralised. */
export function escapeJs(value: string): string {
  return JSON.stringify(String(value ?? ""))
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Only http(s) survives. Blocks javascript:/data: sneaking in via the DB. */
export function safeUrl(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : fallback;
  } catch {
    return fallback;
  }
}

function collapse(value: unknown, max: number): string {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

// ------------------------------------------------------------------ template

export interface OgPageData {
  name: string;
  verdict: string;
  place: string;
  image: string;
  /** Absolute URL of this unfurl endpoint — what gets pasted into the chat. */
  canonical: string;
  /** Absolute URL of the real SPA route, where a human should end up. */
  target: string;
}

/**
 * Pure so it can be tested without a network or a Deno runtime.
 * Every interpolation goes through escapeHtml / escapeJs / safeUrl.
 */
export function renderOgHtml(d: OgPageData): string {
  const title = `${collapse(d.name, 90)} — verified`;
  const description = collapse(d.verdict, 200) || "Verified by Tablestakes.";
  const place = collapse(d.place, 90);
  const image = safeUrl(d.image);
  const canonical = safeUrl(d.canonical);
  const target = safeUrl(d.target, "/");

  const imageTags = image
    ? `
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(title)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />

    <meta property="og:site_name" content="Tablestakes" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />${imageTags}

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />

    <meta name="theme-color" content="#9c3b23" />
    <meta http-equiv="refresh" content="0; url=${escapeHtml(target)}" />
    <style>
      body { margin: 0; background: #faf8f4; color: #1c1a17;
        font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; }
      main { max-width: 34rem; margin: 0 auto; padding: 20vh 1.5rem; text-align: center; }
      h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 .5rem; }
      p { color: #6b6560; margin: 0 0 1.5rem; }
      a { color: #9c3b23; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(collapse(d.name, 90))}</h1>
      ${place ? `<p>${escapeHtml(place)}</p>` : ""}
      <p>${escapeHtml(description)}</p>
      <a href="${escapeHtml(target)}">open on Tablestakes</a>
    </main>
    <script>
      window.location.replace(${escapeJs(target)});
    </script>
  </body>
</html>
`;
}

export function renderNotFoundHtml(homeUrl: string): string {
  const home = safeUrl(homeUrl, "/");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tablestakes — link expired</title>
    <meta name="description" content="That share link is no longer available." />
    <meta property="og:title" content="Tablestakes" />
    <meta property="og:description" content="That share link is no longer available." />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary" />
  </head>
  <body>
    <p>That link has expired. <a href="${escapeHtml(home)}">Find where you should eat</a>.</p>
  </body>
</html>
`;
}

// ------------------------------------------------------------------ data

/** PostgREST returns an object for a to-one embed, an array when unsure. */
function firstEmbedded(v: unknown): Record<string, unknown> | null {
  if (Array.isArray(v)) return (v[0] as Record<string, unknown>) ?? null;
  if (v && typeof v === "object") return v as Record<string, unknown>;
  return null;
}

const SELECT =
  "slug,og_image,dossier:dossiers(verdict,restaurant:restaurants(name,city,neighborhood))";

async function fetchCard(
  slug: string,
): Promise<{ name: string; verdict: string; place: string; image: string } | null> {
  const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!base || !key) {
    console.warn("[og] SUPABASE_URL / SUPABASE_ANON_KEY missing");
    return null;
  }

  const url =
    `${base}/rest/v1/share_cards` +
    `?slug=eq.${encodeURIComponent(slug)}` +
    `&select=${encodeURIComponent(SELECT)}` +
    `&limit=1`;

  let rows: unknown;
  try {
    const res = await fetch(url, {
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        accept: "application/json",
      },
    });
    if (!res.ok) {
      console.warn(`[og] postgrest ${res.status}`);
      return null;
    }
    rows = await res.json();
  } catch (e) {
    console.warn(`[og] postgrest fetch failed: ${(e as Error)?.message ?? e}`);
    return null;
  }

  const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown>) : null;
  if (!row) return null;

  const dossier = firstEmbedded(row.dossier);
  const restaurant = dossier ? firstEmbedded(dossier.restaurant) : null;
  if (!dossier || !restaurant) return null; // dossier or restaurant deleted

  const name = typeof restaurant.name === "string" ? restaurant.name : "";
  if (!name) return null;

  return {
    name,
    verdict: typeof dossier.verdict === "string" ? dossier.verdict : "",
    place: [restaurant.neighborhood, restaurant.city]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .join(", "),
    image: typeof row.og_image === "string" ? row.og_image : "",
  };
}

// ------------------------------------------------------------------ handler

function html(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      ...CORS_HEADERS,
      "content-type": "text/html; charset=utf-8",
      // Crawlers refetch aggressively; 5 minutes keeps invocations cheap while
      // still letting a regenerated image appear quickly.
      "cache-control": status === 200 ? "public, max-age=300" : "public, max-age=60",
    },
  });
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  const site = (Deno.env.get("SITE_URL") || DEFAULT_SITE_URL).replace(/\/+$/, "");
  const requestUrl = new URL(req.url);
  // Accept ?slug=x and the path form /og/x, so a prettier route can be proxied.
  const slug =
    requestUrl.searchParams.get("slug")?.trim() ||
    requestUrl.pathname.split("/").filter(Boolean).pop()?.trim() ||
    "";

  if (!slug || slug === "og" || !/^[\w-]{1,64}$/.test(slug)) {
    return html(renderNotFoundHtml(site), 404);
  }

  const card = await fetchCard(slug);
  if (!card) return html(renderNotFoundHtml(site), 404);

  return html(
    renderOgHtml({
      name: card.name,
      verdict: card.verdict,
      place: card.place,
      // Falls back to the app icon so the unfurl still shows a mark rather
      // than a bare link when image generation failed on the client.
      image: card.image || `${site}/icon-512.png`,
      canonical: requestUrl.toString(),
      target: `${site}/r/${encodeURIComponent(slug)}`,
    }),
    200,
  );
}

// Guarded so the pure template functions above can be imported by a test
// runner (node/tsx) where `Deno` does not exist.
if (typeof Deno !== "undefined" && typeof Deno.serve === "function") {
  Deno.serve(handleRequest);
}
