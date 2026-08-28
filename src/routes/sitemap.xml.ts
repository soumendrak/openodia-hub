import { createFileRoute } from "@tanstack/react-router";

const pages = [
  { path: "", changefreq: "weekly", priority: "1.0" },
  { path: "about", changefreq: "monthly", priority: "0.8" },
  { path: "tools", changefreq: "daily", priority: "0.9" },
  { path: "models", changefreq: "daily", priority: "0.9" },
  { path: "datasets", changefreq: "daily", priority: "0.9" },
  { path: "tutorials", changefreq: "daily", priority: "0.9" },
  { path: "playground", changefreq: "monthly", priority: "0.6" },
  { path: "events", changefreq: "daily", priority: "0.9" },
  { path: "papers", changefreq: "weekly", priority: "0.8" },
  { path: "treebank", changefreq: "monthly", priority: "0.7" },
  { path: "contribute", changefreq: "monthly", priority: "0.7" },
  { path: "api", changefreq: "monthly", priority: "0.5" },
] as const;

function generateSitemap(baseUrl: string) {
  const entries = pages
    .map(
      (p) =>
        `  <url>
    <loc>${baseUrl}/${p.path}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}

export const Route = createFileRoute("/sitemap/xml")({
  server: {
    handlers: {
      GET: async () => {
        const baseUrl = "https://openodia.com";
        const xml = generateSitemap(baseUrl);

        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
