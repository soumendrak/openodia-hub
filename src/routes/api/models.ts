import { createFileRoute } from "@tanstack/react-router";
import { apiJson, apiUnavailable } from "../../lib/api-response";
import { loadModels } from "../../lib/sources/huggingface";

export const Route = createFileRoute("/api/models")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const page = await loadModels();
          return apiJson(
            {
              models: page.items,
              truncated: page.truncated,
              fetchedAt: new Date().toISOString(),
            },
            200,
            3600,
          );
        } catch (e) {
          return apiUnavailable(e, "models");
        }
      },
    },
  },
});
