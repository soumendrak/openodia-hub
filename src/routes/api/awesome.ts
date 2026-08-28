import { createFileRoute } from "@tanstack/react-router";
import { apiJson, apiUnavailable } from "../../lib/api-response";
import { loadAwesome } from "../../lib/sources/awesome";

export const Route = createFileRoute("/api/awesome")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return apiJson({ items: await loadAwesome() }, 200, 3600);
        } catch (e) {
          return apiUnavailable(e, "awesome");
        }
      },
    },
  },
});
