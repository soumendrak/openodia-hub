import { createFileRoute } from "@tanstack/react-router";
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
          return new Response(JSON.stringify({ channels: [], error: "internal_error" }), {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, OPTIONS",
            },
          });
        }
      },
    },
  },
});
