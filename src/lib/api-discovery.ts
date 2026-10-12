import { OPENAPI_SPEC } from "./openapi";
import { SITE } from "./seo";

export const API_CATALOG = {
  linkset: [
    {
      anchor: `${SITE}/.well-known/api-catalog`,
      item: [
        ...Object.keys(OPENAPI_SPEC.paths).filter((path) => path.startsWith("/api/")),
        "/mcp",
      ].map((path) => ({ href: `${SITE}${path}` })),
    },
    ...[...Object.keys(OPENAPI_SPEC.paths).filter((path) => path.startsWith("/api/")), "/mcp"].map(
      (path) => ({
        anchor: `${SITE}${path}`,
        "service-desc": [{ href: `${SITE}/.well-known/openapi.json`, type: "application/json" }],
        "service-doc": [{ href: `${SITE}/api${path === "/mcp" ? "#mcp" : ""}`, type: "text/html" }],
        status: [{ href: `${SITE}/api/health`, type: "application/json" }],
      }),
    ),
  ],
};

/** Static discovery and liveness must remain available when upstream catalogs fail. */
export function handleApiDiscovery(request: Request): Response | undefined {
  const path = new URL(request.url).pathname;
  if (path !== "/.well-known/api-catalog" && path !== "/api/health") return;
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Cache-Control": path === "/api/health" ? "no-store" : "public, max-age=3600",
  });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (!["GET", "HEAD"].includes(request.method)) {
    headers.set("Allow", "GET, HEAD, OPTIONS");
    return new Response(null, { status: 405, headers });
  }
  headers.set(
    "Content-Type",
    path === "/api/health" ? "application/json" : "application/linkset+json",
  );
  if (path !== "/api/health") {
    headers.set(
      "Link",
      '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json", <https://www.rfc-editor.org/info/rfc9727>; rel="profile"',
    );
  }
  const body =
    path === "/api/health"
      ? { status: "ok", service: "openodia-hub", scope: "liveness", upstreamsChecked: false }
      : API_CATALOG;
  return new Response(request.method === "HEAD" ? null : JSON.stringify(body), { headers });
}
