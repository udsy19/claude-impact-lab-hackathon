/**
 * db/index.ts — pick a backend once, at module load, and never think about it
 * again. Everything downstream imports `db` and codes against the Store
 * interface; swapping Postgres for localStorage is invisible above this line.
 *
 * Supabase wins when it is configured, except under `?demo=1`, which is a
 * deliberate escape hatch: a demo should be reproducible and self-contained,
 * not dependent on whatever happens to be in the shared project today.
 */

import { createLocalStore } from "./local";
import { createSupabaseStore } from "./supabase";
import type { Store } from "./types";

function demoRequested(): boolean {
  try {
    const search = globalThis.location?.search;
    return typeof search === "string" && new URLSearchParams(search).get("demo") === "1";
  } catch {
    return false;
  }
}

const demo = demoRequested();
const supabaseStore = demo ? null : createSupabaseStore();

/** The single storage backend for the app. */
export const db: Store = supabaseStore ?? createLocalStore();

/** True when reads and writes are hitting Postgres rather than localStorage. */
export const usingSupabase: boolean = supabaseStore !== null;

console.info(
  `[db] backend: ${db.kind}${demo ? " (forced by ?demo=1)" : usingSupabase ? "" : " (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set)"}`,
);
