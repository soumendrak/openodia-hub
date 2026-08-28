/**
 * Two-layer cache for upstream fan-outs, with stale-while-revalidate.
 *
 *   1. An in-isolate memo — the layer that actually fires, and the only one
 *      that works in local dev (`caches.default` is a no-op there).
 *   2. The Workers edge cache — shared across isolates in the same colo, so a
 *      cold isolate doesn't have to re-fan-out.
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

type EdgeCache = {
  match: (key: string) => Promise<Response | undefined>;
  put: (key: string, response: Response) => Promise<void>;
};

/** `{ at, value }` — the age has to travel with the value for SWR to work. */
type Entry<T> = { at: number; value: T };

function edgeCache(): EdgeCache | undefined {
  return (globalThis as { caches?: { default?: EdgeCache } }).caches?.default;
}

/**
 * How long past the TTL a value stays servable while its refresh runs. Beyond
 * this the next reader waits for fresh data rather than being handed something
 * a day out of date.
 */
const STALE_WINDOW_MS = 24 * 60 * 60 * 1000;

// v2: entries are `{ at, value }` envelopes now, so old bodies must not be read.
const CACHE_PREFIX = "https://openodia.com/__cache/v2/";

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
export type CacheLayer = "MEMO" | "EDGE" | "STALE" | "MISS";

let lastLayer: CacheLayer = "MISS";

/** The layer that served the most recent `cachedJson` call on this isolate. */
export function lastCacheLayer(): CacheLayer {
  return lastLayer;
}

async function readEdge<T>(key: string): Promise<Entry<T> | undefined> {
  try {
    const stored = await edgeCache()?.match(CACHE_PREFIX + key);
    if (!stored) return undefined;
    const entry = (await stored.json()) as Entry<T>;
    return typeof entry?.at === "number" ? entry : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Runs `load` at most once per key at a time and publishes the result to both
 * layers. A failing loader is deliberately not cached — see loadRepos, which
 * throws rather than let "GitHub throttled us" be stored as "there are no
 * repos".
 */
function refresh<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const run = (async () => {
    const value = await load();
    const entry: Entry<T> = { at: Date.now(), value };
    memo.set(key, entry);
    await edgeCache()
      ?.put(
        CACHE_PREFIX + key,
        new Response(JSON.stringify(entry), {
          headers: {
            "Content-Type": "application/json",
            // The edge copy has to outlive the TTL for stale serving to work.
            "Cache-Control": `public, s-maxage=${Math.round((ttlMs + STALE_WINDOW_MS) / 1000)}`,
          },
        }),
      )
      .catch(() => {});
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
  let entry = memo.get(key) as Entry<T> | undefined;
  let layer: CacheLayer = "MEMO";

  if (!entry) {
    entry = await readEdge<T>(key);
    if (entry) {
      memo.set(key, entry);
      layer = "EDGE";
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
      const pending = refresh(key, ttlMs, load).catch((err) => {
        console.warn(`cache refresh ${key}:`, err);
      });
      executionCtx?.waitUntil(pending);
      lastLayer = "STALE";
      return entry.value;
    }
  }

  lastLayer = "MISS";
  return refresh(key, ttlMs, load);
}

/** Thrown when every upstream call failed — distinct from "upstream has nothing". */
export class UpstreamUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamUnavailableError";
  }
}
