/**
 * CORS headers for public API endpoints.
 * Applied to all /api/* responses so browser-based agents can consume them.
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, User-Agent",
  "Access-Control-Max-Age": "86400",
};

/**
 * Wrap an existing Response with CORS headers.
 * Does not duplicate headers that already exist.
 */
export function withCors(response: Response): Response {
  const existing = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    if (!existing.has(key)) {
      existing.set(key, value);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: existing,
  });
}
