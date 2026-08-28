/**
 * Shared response shape for the public `/api/*` handlers.
 *
 * `X-Cache` reports which layer answered (see lib/sources/cache), so a cold
 * fan-out is distinguishable from a cached hit without reading logs.
 */
import { lastCacheLayer } from "./sources/cache";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, User-Agent",
};

export function apiJson(body: unknown, status = 200, maxAgeSeconds?: number): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...CORS,
  };
  if (maxAgeSeconds) {
    headers["Cache-Control"] = `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=86400`;
    headers["X-Cache"] = lastCacheLayer();
  }
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Upstream is unreachable. Deliberately a 503, not a 200 with an empty list:
 * an empty 200 renders a blank directory that looks complete.
 */
export function apiUnavailable(error: unknown, context: string): Response {
  console.error(`${context}:`, error);
  const reason = error instanceof Error ? error.message : "unknown";
  return apiJson({ error: "upstream_unavailable", reason }, 503);
}
