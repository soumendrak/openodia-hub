import { createFileRoute } from "@tanstack/react-router";
import { withDeadline } from "../lib/fetch-utils";
import { loadCatalog } from "../lib/sources/catalog";
import { SITE } from "../lib/seo";

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

/** Sitemaps cap at 50k URLs; the catalog is far below that, but bound it anyway. */
const MAX_RESOURCE_URLS = 20000;

type Entry = { loc: string; changefreq: string; priority: string; lastmod?: string };

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** W3C date. `lastmod` is only emitted when the upstream actually reported one. */
function isoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

/**
 * The `/r/*` permalinks — a few hundred real pages (one per repo, model, and
 * dataset) that were previously discoverable only by crawling the directory's
 * paginated card grid. Listing them explicitly is what gets them indexed and,
 * in turn, cited by answer engines.
 */
async function resourceEntries(): Promise<Entry[]> {
  const catalog = await loadCatalog();
  const seen = new Set<string>();
  const entries: Entry[] = [];
  for (const e of catalog) {
    if (!e.permalink || seen.has(e.permalink)) continue;
    seen.add(e.permalink);
    entries.push({
      loc: `${SITE}${e.permalink}`,
      changefreq: "weekly",
      priority: "0.6",
      // Hugging Face models report only a creation date; a real older date
      // is a better lastmod hint than none.
      lastmod: isoDate(e.updatedAt ?? e.createdAt),
    });
    if (entries.length >= MAX_RESOURCE_URLS) break;
  }
  return entries;
}

function renderSitemap(entries: Entry[]): string {
  const body = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${xmlEscape(e.loc)}</loc>\n` +
        (e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : "") +
        `    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
}

export const Route = createFileRoute("/sitemap/xml")({
  server: {
    handlers: {
      GET: async () => {
        const staticEntries: Entry[] = pages.map((p) => ({
          loc: p.path ? `${SITE}/${p.path}` : SITE,
          changefreq: p.changefreq,
          priority: p.priority,
        }));

        // A cold catalog must not hold the sitemap open; ship the static pages
        // and cache that short so the next crawl picks up the full list.
        const resources = await withDeadline(resourceEntries(), 6000, [] as Entry[]);
        const xml = renderSitemap([...staticEntries, ...resources]);

        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": resources.length ? "public, max-age=3600" : "public, max-age=120",
          },
        });
      },
    },
  },
});
