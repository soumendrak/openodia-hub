/**
 * Small utilities for resilient upstream calls from API route handlers.
 *
 *   - fetchWithTimeout aborts a request that exceeds a wall-clock budget so a
 *     single hung upstream can't hold the whole response open.
 *   - settledValues filters Promise.allSettled results down to the fulfilled
 *     ones so a single failing fan-out arm doesn't take the rest down.
 */

const DEFAULT_TIMEOUT_MS = 8000;

export async function fetchWithTimeout(
  input: string | URL,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function settledValues<T>(results: PromiseSettledResult<T>[]): T[] {
  const values: T[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      values.push(r.value);
    } else {
      console.warn("settled rejection:", r.reason);
    }
  }
  return values;
}

/**
 * Runs `fn` over `items` with at most `limit` in flight. Order is preserved.
 *
 * `Promise.all` over a long list opens every connection at once; the requests
 * at the back then spend their whole timeout budget queued and abort.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Resolves to `fallback` if `promise` hasn't settled within `ms`.
 *
 * For callers that must stay fast and can render without a value — the home
 * page's ecosystem counts drop a tile rather than hold the whole page on a
 * cold upstream.
 */
export function withDeadline<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}
