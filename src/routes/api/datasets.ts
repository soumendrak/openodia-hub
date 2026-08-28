import { createFileRoute } from "@tanstack/react-router";
import { apiJson, apiUnavailable } from "../../lib/api-response";
import { loadDatasets } from "../../lib/sources/huggingface";

export const Route = createFileRoute("/api/datasets")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const page = await loadDatasets();
          return apiJson(
            {
              datasets: page.items,
              truncated: page.truncated,
              fetchedAt: new Date().toISOString(),
            },
            200,
            3600,
          );
        } catch (e) {
          return apiUnavailable(e, "datasets");
        }
      },
    },
  },
});
