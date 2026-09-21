import { createFileRoute } from "@tanstack/react-router";
import { apiJson, apiUnavailable } from "../../lib/api-response";
import { type SearchKind, searchDocuments } from "../../lib/search";
import { loadSearchSnapshot } from "../../lib/sources/search";

const VALID_KINDS = new Set<SearchKind>([
  "page",
  "repository",
  "tool",
  "model",
  "dataset",
  "paper",
  "tutorial",
  "event",
]);
const MAX_QUERY_LENGTH = 80;
const MAX_LIMIT = 50;

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const query = (url.searchParams.get("q") ?? "").trim();
        if (!query) return apiJson({ error: "query_required" }, 400);
        if (query.length > MAX_QUERY_LENGTH) return apiJson({ error: "query_too_long" }, 400);
        const kindParam = url.searchParams.get("kind");
        const requestedKinds = kindParam?.split(",").filter(Boolean) ?? [];
        const kinds = requestedKinds.filter((kind): kind is SearchKind =>
          VALID_KINDS.has(kind as SearchKind),
        );
        if (requestedKinds.length > 0 && kinds.length !== requestedKinds.length) {
          return apiJson({ error: "invalid_kind" }, 400);
        }
        const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
        const limit = Number.isFinite(requestedLimit)
          ? Math.max(1, Math.min(requestedLimit, MAX_LIMIT))
          : 20;
        try {
          const snapshot = await loadSearchSnapshot();
          const results = searchDocuments(snapshot.documents, query, {
            kinds: kinds.length > 0 ? kinds : undefined,
            limit,
          });
          return apiJson(
            {
              results,
              partial: snapshot.sources.some((source) => source.status !== "ready"),
              sources: snapshot.sources,
              builtAt: snapshot.builtAt,
            },
            200,
            300,
          );
        } catch (error) {
          return apiUnavailable(error, "search");
        }
      },
    },
  },
});
