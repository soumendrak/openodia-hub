import { createFileRoute } from "@tanstack/react-router";
import { apiJson } from "../../lib/api-response";
import { getLocaleStatus } from "../../lib/locale-status";

export const Route = createFileRoute("/api/translation-status")({
  server: { handlers: { GET: () => apiJson(getLocaleStatus(), 200, 300) } },
});
