import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/pypi")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const r = await fetch("https://pypi.org/pypi/openodia/json", {
            headers: { "User-Agent": "openodia.com" },
          });
          if (!r.ok) {
            return Response.json({ version: "0.1.0", summary: "", releases: 0 });
          }
          const j = (await r.json()) as {
            info: { version: string; summary: string };
            releases: Record<string, unknown>;
          };
          return new Response(
            JSON.stringify({
              version: j.info.version,
              summary: j.info.summary,
              releases: Object.keys(j.releases ?? {}).length,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
              },
            }
          );
        } catch (e) {
          console.error("pypi error", e);
          return Response.json({ version: "0.1.0", summary: "", releases: 0 });
        }
      },
    },
  },
});
