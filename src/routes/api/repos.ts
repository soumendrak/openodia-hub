import { createFileRoute } from "@tanstack/react-router";
import { apiJson, apiUnavailable } from "../../lib/api-response";
import { loadRepos } from "../../lib/sources/repos";

export const Route = createFileRoute("/api/repos")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return apiJson({ repos: await loadRepos() }, 200, 1800);
        } catch (e) {
          return apiUnavailable(e, "repos");
        }
      },
    },
  },
});
