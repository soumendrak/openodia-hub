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
