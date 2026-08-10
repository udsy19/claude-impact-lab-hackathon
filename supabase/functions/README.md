# Edge functions

## `og` — the crawler-facing share link

`/r/<slug>` is a client-rendered SPA route. Its OG tags are written by
`setOgTags()` after React mounts, and **iMessage, Slack, Twitter, WhatsApp and
Discord do not execute JavaScript** — they fetch the HTML once, read whatever
`<meta>` is present in those bytes, and leave. So every shared link unfurled
with the generic fallback title from `index.html`, which is the growth loop
leaking at exactly the point where it should be working hardest. This function
closes that hole: it looks the share card up in Postgres and returns static HTML
carrying the real `og:title`, `og:description` and a 1200×630 `og:image`, then
sends a human straight on to `/r/<slug>` via a meta refresh, a JS redirect and a
plain `<a>` for the no-JS case. Crawlers get the tags; people get the app.

Shared URLs therefore point at the function, not at the SPA route —
`ogFunctionUrl(slug)` in `src/lib/share.ts` builds them, falling back to the
plain `/r/<slug>` URL when `VITE_SUPABASE_URL` is unset.

```
https://<project-ref>.supabase.co/functions/v1/og?slug=<slug>
```

### 1. Create the public `og` storage bucket

The client renders the card with `html-to-image` and PUTs the PNG here with the
anon key, so the bucket must be public **and** must allow anonymous inserts.

CLI:

```bash
supabase storage create-bucket og --public --experimental
```

Or SQL (dashboard SQL editor — idempotent, and this is the form that also sets
the policies):

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('og', 'og', true, 2097152, array['image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/png'];

-- Anyone may read (the bucket is public, but crawlers hit the REST path too).
drop policy if exists og_public_read on storage.objects;
create policy og_public_read on storage.objects
  for select using (bucket_id = 'og');

-- Anon may upload a card. Object keys are 12 random chars, so a client cannot
-- guess and clobber someone else's card; there is no update/delete policy.
drop policy if exists og_anon_insert on storage.objects;
create policy og_anon_insert on storage.objects
  for insert with check (bucket_id = 'og');
```

Public URLs then look like:

```
https://<project-ref>.supabase.co/storage/v1/object/public/og/<key>.png
```

### 2. Set the site URL

The function needs to know where the SPA lives so it can build `og:url` and the
redirect target. Without this it falls back to the `DEFAULT_SITE_URL` constant
in `og/index.ts`.

```bash
supabase secrets set SITE_URL=https://your-deployed-app.example
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected by the platform — do not set
them yourself.

### 3. Deploy

```bash
supabase link --project-ref <project-ref>       # once
supabase functions deploy og --no-verify-jwt
```

**`--no-verify-jwt` is required.** By default Supabase rejects any request to a
function without a valid `Authorization: Bearer <jwt>` header. Crawlers send no
headers at all — Slackbot and Twitterbot just GET the URL — so with JWT
verification on, every unfurl would 401 and the whole point of the function
would be lost. The function is read-only and returns nothing that isn't already
public via the anon-readable `share_cards` table.

### 4. Verify

```bash
# a real slug
curl -s "https://<project-ref>.supabase.co/functions/v1/og?slug=<slug>" | grep 'og:'

# an unknown slug -> 404 with a minimal valid page
curl -s -o /dev/null -w '%{http_code}\n' \
  "https://<project-ref>.supabase.co/functions/v1/og?slug=nope"
```

Then paste the URL into the [Facebook sharing debugger](https://developers.facebook.com/tools/debug/)
or a Slack DM to yourself.

### Local run

```bash
supabase functions serve og --no-verify-jwt --env-file supabase/.env.local
curl -s 'http://localhost:54321/functions/v1/og?slug=<slug>'
```

### Notes

- Dependency-free Deno: `Deno.serve` plus `fetch` against PostgREST. Nothing to
  install, no esm.sh pin to rot.
- Every interpolated value goes through `escapeHtml` / `escapeJs` / `safeUrl`,
  so a restaurant named `Joe's <b>"Diner"</b>` cannot break out of an attribute
  or inject a script, and a `javascript:` URL in `og_image` is dropped.
- `renderOgHtml`, `renderNotFoundHtml`, `escapeHtml`, `escapeJs` and `safeUrl`
  are exported as pure functions so the template can be tested without a Deno
  runtime or a network. `Deno.serve` is only called when the `Deno` global
  exists.
- Responses are cached for 5 minutes (`cache-control: public, max-age=300`);
  crawlers refetch aggressively.
