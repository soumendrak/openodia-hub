import { createFileRoute } from "@tanstack/react-router";
import { apiJson, apiUnavailable } from "../../lib/api-response";
import { loadCatalog, queryCatalog } from "../../lib/sources/catalog";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function intParam(value: string | null, fallback: number, max: number): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
}

export const Route = createFileRoute("/api/resources")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const url = new URL(request.url);
          const entries = await loadCatalog();
          const result = queryCatalog(entries, {
            kind: url.searchParams.get("kind") ?? undefined,
            license: url.searchParams.get("license") ?? undefined,
            author: url.searchParams.get("author") ?? undefined,
            q: url.searchParams.get("q") ?? undefined,
            limit: intParam(url.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT),
            offset: intParam(url.searchParams.get("offset"), 0, Number.MAX_SAFE_INTEGER),
          });
          return apiJson({ ...result, fetchedAt: new Date().toISOString() }, 200, 3600);
        } catch (e) {
          return apiUnavailable(e, "resources");
        }
      },
    },
  },
});
