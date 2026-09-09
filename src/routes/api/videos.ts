import { createFileRoute } from "@tanstack/react-router";
import { UpstreamUnavailableError } from "../../lib/sources/cache";
import { loadVideos } from "../../lib/sources/videos";

export const Route = createFileRoute("/api/videos")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const channels = await loadVideos();
          return new Response(JSON.stringify({ channels }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, User-Agent",
            },
          });
        } catch (e) {
          console.error("videos error", e);
          // 503, not 500, when YouTube is the thing that failed: the spec
          // already documents that status for an unreachable upstream on the
          // other endpoints, and it tells a caller to retry rather than to
          // report a bug in this service.
          const upstream = e instanceof UpstreamUnavailableError;
          return new Response(
            JSON.stringify({
              channels: [],
              error: upstream ? e.message : "internal_error",
            }),
            {
              status: upstream ? 503 : 500,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
              },
            },
          );
        }
      },
    },
  },
});
