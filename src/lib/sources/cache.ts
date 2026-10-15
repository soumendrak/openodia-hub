/**
 * Two-layer cache for upstream fan-outs, with stale-while-revalidate.
 *
 *   1. An in-isolate memo — the fastest layer, but it dies with the isolate.
 *   2. Workers KV — globally replicated, so a cold isolate in *any* colo reads
 *      a value another colo (or the cron) wrote.
 *
 * Layer 2 used to be `caches.default`. That cache is per-colo, so it only ever
 * warmed the one colo that happened to populate it: measured in production,
 * ~85% of /api/repos requests reported MISS and paid the full ~130-call GitHub
 * fan-out at 3.6-5.0s TTFB, and the EDGE layer was never once observed serving.
 * The daily cron warm-up had the same blind spot — it warms whichever colo it
 * runs in and no other. KV is replicated, so one write serves every colo.
 *
 * Values are cached, not Responses, because route loaders (SSR) and the
 * `/api/*` handlers both consume them.
 *
 * Past the TTL a value is *stale*, not gone: it is served immediately and the
 * refresh runs behind the response. Without this, one unlucky visitor every
 * TTL pays for the whole fan-out (loadRepos alone is ~130 GitHub calls) while
 * the page waits. Refreshes are single-flighted, so a burst of requests
 * arriving on a cold key triggers one fan-out, not one per request.
 */

/** The slice of the Workers KV binding this uses. */
type KvStore = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
};

/** `{ at, value }` — the age has to travel with the value for SWR to work. */
type Entry<T> = { at: number; value: T };

let store: KvStore | undefined;

/**
 * Hands the Worker's KV binding to the cache. Called from both the fetch and
 * scheduled handlers; without it the cache degrades to memo-only, which is
 * exactly the behaviour this replaced, so an unbound namespace is survivable
 * rather than fatal.
 */
export function setCacheStore(binding: unknown): void {
  const kv = binding as KvStore | undefined;
  if (kv && typeof kv.get === "function" && typeof kv.put === "function") {
    store = kv;
  }
}

/**
 * How long past the TTL a value stays servable while its refresh runs. Beyond
 * this the next reader waits for fresh data rather than being handed something
 * a day out of date.
 */
const STALE_WINDOW_MS = 24 * 60 * 60 * 1000;

// v3: the store moved from the Cache API to KV, so keys are plain strings and
// nothing written under the old scheme should be read.
const CACHE_PREFIX = "cache:v3:";

const memo = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

type ExecutionCtx = { waitUntil: (promise: Promise<unknown>) => void };
let executionCtx: ExecutionCtx | undefined;

/**
 * Hands the Worker's `ctx` to the cache so background refreshes survive the
 * response being sent — a floating promise is otherwise cancelled when the
 * request ends. The ctx of whichever request happened to trigger the refresh
 * is fine: `waitUntil` only extends that invocation's lifetime.
 */
export function setExecutionContext(ctx: unknown): void {
  if (ctx && typeof (ctx as ExecutionCtx).waitUntil === "function") {
    executionCtx = ctx as ExecutionCtx;
  }
}

/** Where a value came from — surfaced as `X-Cache` on the `/api/*` responses. */
export type CacheLayer = "MEMO" | "KV" | "STALE" | "MISS";

let lastLayer: CacheLayer = "MISS";

/** The layer that served the most recent `cachedJson` call on this isolate. */
export function lastCacheLayer(): CacheLayer {
  return lastLayer;
}

/** Rejects when the store itself fails; a missing or corrupt entry is `undefined`. */
async function readEntry<T>(key: string): Promise<Entry<T> | undefined> {
  const raw = await store?.get(CACHE_PREFIX + key);
  if (!raw) return undefined;
  try {
    const entry = JSON.parse(raw) as Entry<T>;
    // A future `at` (clock skew, bad write) gives a negative age, which would
    // look fresh past the TTL and, if clamped to now, re-clamp on every read
    // and never expire. Treat it like a corrupt entry: reload and rewrite.
    return typeof entry?.at === "number" && entry.at <= Date.now() ? entry : undefined;
  } catch {
    return undefined;
  }
}

function readStore<T>(key: string): Promise<Entry<T> | undefined> {
  return readEntry<T>(key).catch(() => undefined);
}

async function writeStore<T>(key: string, entry: Entry<T>, ttlMs: number): Promise<void> {
  // The stored copy has to outlive the TTL for stale serving to work. KV's
  // floor for expirationTtl is 60s, which every caller here clears comfortably.
  const expirationTtl = Math.round((ttlMs + STALE_WINDOW_MS) / 1000);
  await store?.put(CACHE_PREFIX + key, JSON.stringify(entry), { expirationTtl });
}

/**
 * KV write budget. The free tier allows ~1,000 writes/day per account, and
 * every isolate in every colo used to write its own refresh of every key it
 * served past the TTL — unconditionally, even when the value had not changed
 * and even when another isolate had already refreshed it. With ~350 keys
 * (incl. per-resource / per-preview pages) that hit the cap daily.
 *
 * Now a refresh (a) adopts a fresh copy another isolate already stored,
 * without loading or writing, and (b) only writes when the value changed and
 * the stored copy is at least MIN_WRITE_INTERVAL_MS old, or when an unchanged
 * copy needs re-writing before its KV expiry. Short TTLs still refresh the
 * in-isolate memo on schedule; only the KV write is rate-limited.
 *
 * Per-item keys (resource:*, preview:*) are unbounded in number, so they stay
 * memo-only: a cold isolate pays one upstream call for them, not a fan-out.
 *
 * Bound: with K persisted keys (~11) and W isolates that race on the same
 * refresh window (reads before puts propagate), changed values cost at most
 *   K × (24h / 6h) × W = K × 4 × W writes/day,
 * and unchanged values K × (24h / 20h) × W ≈ K × 1.2 × W. With K = 11 that is
 * ~44·W, so the 1,000/day cap holds for up to ~20 concurrent writers per window.
 */
export const MIN_WRITE_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Key prefixes kept out of KV; see above. */
const MEMO_ONLY_PREFIXES = ["resource:", "preview:"];

/** Must stay below STALE_WINDOW_MS so an unchanged copy never expires. */
export const REWRITE_UNCHANGED_MS = 20 * 60 * 60 * 1000;

/**
 * JSON form used for change detection. A top-level `builtAt` (the search
 * snapshot stamps one on every build) is ignored, or every load would count
 * as a change. Values are JSON by construction — writeStore serializes them.
 */
function comparable(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value) && "builtAt" in value) {
    const { builtAt: _builtAt, ...rest } = value as Record<string, unknown>;
    return JSON.stringify(rest);
  }
  return JSON.stringify(value);
}

function shouldWrite<T>(stored: Entry<T> | undefined, value: T, now: number): boolean {
  if (!stored) return true;
  const age = now - stored.at;
  if (comparable(stored.value) === comparable(value)) return age >= REWRITE_UNCHANGED_MS;
  return age >= MIN_WRITE_INTERVAL_MS;
}

/**
 * Runs `load` at most once per key at a time and publishes the result to both
 * layers. A failing loader is deliberately not cached — see loadRepos, which
 * throws rather than let "GitHub throttled us" be stored as "there are no
 * repos".
 */
function refresh<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  persist: boolean,
): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const run = (async () => {
    // Another isolate may already have refreshed this key: adopt its copy
    // instead of re-running the fan-out and writing a duplicate.
    let stored: Entry<T> | undefined;
    // A failed read (e.g. read quota exhausted) is not a miss: without the
    // stored timestamp the write gate can't work, so skip the write.
    let readFailed = false;
    if (store && persist) {
      try {
        stored = await readEntry<T>(key);
      } catch {
        readFailed = true;
      }
    }
    if (stored && Date.now() - stored.at < ttlMs) {
      memo.set(key, stored);
      return stored.value;
    }
    const value = await load();
    const now = Date.now();
    const entry: Entry<T> = { at: now, value };
    memo.set(key, entry);
    if (!store || !persist || readFailed || !shouldWrite(stored, value, now)) return value;
    // The caller is already waiting on the fan-out; don't make it wait on the
    // write too. waitUntil keeps it alive past the response where there is a
    // ctx to hang it on, and the cron path has none, so it awaits.
    const write = writeStore(key, entry, ttlMs).catch((err) => {
      console.warn(`cache write ${key}:`, err);
    });
    if (executionCtx) executionCtx.waitUntil(write);
    else await write;
    return value;
  })().finally(() => inflight.delete(key));

  inflight.set(key, run);
  return run;
}

export async function cachedJson<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const persist = !MEMO_ONLY_PREFIXES.some((p) => key.startsWith(p));
  let entry = memo.get(key) as Entry<T> | undefined;
  let layer: CacheLayer = "MEMO";

  if (!entry && persist) {
    entry = await readStore<T>(key);
    if (entry) {
      memo.set(key, entry);
      layer = "KV";
    }
  }

  if (entry) {
    const age = Date.now() - entry.at;
    if (age < ttlMs) {
      lastLayer = layer;
      return entry.value;
    }
    if (age < ttlMs + STALE_WINDOW_MS) {
      // Serve now, refresh behind the response. A refresh that fails leaves
      // the stale value in place for the next reader to try again.
      const pending = refresh(key, ttlMs, load, persist).catch((err) => {
        console.warn(`cache refresh ${key}:`, err);
      });
      executionCtx?.waitUntil(pending);
      lastLayer = "STALE";
      return entry.value;
    }
  }

  lastLayer = "MISS";
  return refresh(key, ttlMs, load, persist);
}

/** Thrown when every upstream call failed — distinct from "upstream has nothing". */
export class UpstreamUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamUnavailableError";
  }
}
