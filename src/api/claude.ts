const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
/**
 * Ranking, tag resolution and name extraction are classification and
 * extraction, not deep reasoning — Haiku does them at a fraction of the
 * latency, which is most of the user-visible wait on the decision flow.
 */
export const FAST_MODEL = "claude-haiku-4-5";

export class MissingClaudeKeyError extends Error {}

function key(): string {
  const k = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  if (!k) {
    throw new MissingClaudeKeyError(
      "No Anthropic key. Add VITE_ANTHROPIC_API_KEY to .env.local and restart the dev server.",
    );
  }
  return k;
}

function headers() {
  return {
    "content-type": "application/json",
    "x-api-key": key(),
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
}

async function failure(res: Response): Promise<never> {
  let detail = "";
  try {
    detail = (await res.json())?.error?.message ?? "";
  } catch {
    detail = await res.text().catch(() => "");
  }
  throw new Error(`Anthropic ${res.status}: ${detail || res.statusText}`);
}

async function once(
  prompt: string,
  maxTokens: number,
  signal?: AbortSignal,
  model: string = MODEL,
): Promise<string> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
    signal,
  });
  if (!res.ok) await failure(res);
  const data = await res.json();
  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
  if (!text.trim()) throw new Error("Empty response from the model.");
  return text;
}

/** One automatic retry, then surface. Never retries a missing-key error. */
export async function complete(
  prompt: string,
  maxTokens = 8000,
  signal?: AbortSignal,
  model: string = MODEL,
): Promise<string> {
  try {
    return await once(prompt, maxTokens, signal, model);
  } catch (err) {
    if (err instanceof MissingClaudeKeyError) throw err;
    if (signal?.aborted) throw err;
    await new Promise((r) => setTimeout(r, 800));
    return await once(prompt, maxTokens, signal, model);
  }
}

/** Streamed completion — synthesis only. onToken fires per text delta. */
export async function completeStream(
  prompt: string,
  onToken: (t: string) => void,
  maxTokens = 8000,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
    signal,
  });
  if (!res.ok) await failure(res);
  if (!res.body) throw new Error("No response stream.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload);
        if (
          evt.type === "content_block_delta" &&
          evt.delta?.type === "text_delta" &&
          typeof evt.delta.text === "string"
        ) {
          full += evt.delta.text;
          onToken(evt.delta.text);
        }
      } catch {
        // partial SSE frame — the next chunk completes it
      }
    }
  }
  if (!full.trim()) throw new Error("Empty stream from the model.");
  return full;
}

/** Models fence JSON despite instructions. Strip, then fall back to a span scan. */
export function parseJSON<T>(raw: string): T {
  let s = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fenced) s = fenced[1].trim();
  try {
    return JSON.parse(s) as T;
  } catch {
    const first = s.search(/[[{]/);
    const last = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
    if (first !== -1 && last > first) return JSON.parse(s.slice(first, last + 1)) as T;
    throw new Error("The model did not return valid JSON.");
  }
}

export async function completeJSON<T>(
  prompt: string,
  maxTokens = 8000,
  signal?: AbortSignal,
  model: string = MODEL,
): Promise<T> {
  return parseJSON<T>(await complete(prompt, maxTokens, signal, model));
}
