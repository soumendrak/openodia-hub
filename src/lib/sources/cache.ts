/**
 * Two-layer cache for upstream fan-outs.
 *
 *   1. An in-isolate memo — the layer that actually fires, and the only one
 *      that works in local dev (`caches.default` is a no-op there).
 *   2. The Workers edge cache — shared across isolates in the same colo, so a
 *      cold isolate doesn't have to re-fan-out.
 *
 * Values are cached, not Responses, because route loaders (SSR) and the
 * `/api/*` handlers both consume them.
 */

type EdgeCache = {
  match: (key: string) => Promise<Response | undefined>;
  put: (key: string, response: Response) => Promise<void>;
};

function edgeCache(): EdgeCache | undefined {
  return (globalThis as { caches?: { default?: EdgeCache } }).caches?.default;
}

const memo = new Map<string, { at: number; value: unknown }>();

/** Where a value came from — surfaced as `X-Cache` on the `/api/*` responses. */
export type CacheLayer = "MEMO" | "EDGE" | "MISS";

let lastLayer: CacheLayer = "MISS";

/** The layer that served the most recent `cachedJson` call on this isolate. */
export function lastCacheLayer(): CacheLayer {
  return lastLayer;
}

export async function cachedJson<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    lastLayer = "MEMO";
    return hit.value as T;
  }

  const cache = edgeCache();
  const cacheUrl = `https://openodia.com/__cache/${key}`;
  const stored = await cache?.match(cacheUrl);
  if (stored) {
    const value = (await stored.json()) as T;
    memo.set(key, { at: Date.now(), value });
    lastLayer = "EDGE";
    return value;
  }

  // A throwing loader is deliberately not cached — see loadRepos, which throws
  // rather than let "GitHub throttled us" be stored as "there are no repos".
  const value = await load();
  memo.set(key, { at: Date.now(), value });
  await cache?.put(
    cacheUrl,
    new Response(JSON.stringify(value), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, s-maxage=${Math.round(ttlMs / 1000)}`,
      },
    }),
  );
  lastLayer = "MISS";
  return value;
}

/** Thrown when every upstream call failed — distinct from "upstream has nothing". */
export class UpstreamUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamUnavailableError";
  }
}
