import { createFileRoute } from "@tanstack/react-router";

type Item = {
  category: string;
  subcategory?: string;
  name: string;
  url: string;
  description: string;
};

const README_URL = "https://raw.githubusercontent.com/odisha-ml/Awesome-Odia-AI/main/README.md";

function parseReadme(md: string): Item[] {
  const lines = md.split("\n");
  const items: Item[] = [];
  let category = "General";
  let subcategory: string | undefined;

  for (const raw of lines) {
    const line = raw.trim();
    // skip the very top H1
    if (line.startsWith("# ")) continue;
    if (line.startsWith("## ")) {
      category = line.replace(/^##\s+/, "").trim();
      subcategory = undefined;
      continue;
    }
    if (line.startsWith("### ") || line.startsWith("#### ")) {
      subcategory = line.replace(/^#+\s+/, "").trim();
      continue;
    }
    if (!line.startsWith("- ")) continue;

    // strip leading "- "
    const body = line.slice(2).trim();

    // find first link
    const linkRe = /\[([^\]]+)\]\(([^)]+)\)/;
    const m = linkRe.exec(body);
    if (!m) continue;

    let name: string;
    let url: string;
    let desc: string;

    if (body.startsWith("[")) {
      // "- [Name](url) : description..."
      name = m[1];
      url = m[2];
      desc = body.slice(m[0].length).replace(/^[\s:.\-–—]+/, "");
    } else {
      // "- Name : description [paper](url) [code](url2)..."
      // Take name as the leading text up to the first ':' or '['
      const sepIdx = (() => {
        const c = body.indexOf(":");
        const b = body.indexOf("[");
        if (c === -1) return b;
        if (b === -1) return c;
        return Math.min(c, b);
      })();
      if (sepIdx <= 0) {
        name = m[1];
        url = m[2];
        desc = body;
      } else {
        name = body.slice(0, sepIdx).trim();
        url = m[2];
        desc = body.slice(sepIdx + 1).trim();
      }
    }

    name = name.replace(/[*_`]/g, "").trim();

    // clean description: drop images, replace links with their text, strip badge artifacts
    desc = desc
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[\s*([^\]]*?)\s*\]\(([^)]+)\)/g, "")
      .replace(/\\\[/g, "")
      .replace(/\\\]/g, "")
      .replace(/\[|\]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!desc) desc = `${category}${subcategory ? " · " + subcategory : ""}`;

    if (/^permalink/i.test(name)) continue;
    if (!/^https?:\/\//.test(url)) continue;
    if (!name) continue;

    items.push({
      category,
      subcategory,
      name,
      url,
      description: desc.length > 280 ? desc.slice(0, 277) + "…" : desc,
    });
  }

  return items;
}

export const Route = createFileRoute("/api/awesome")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const res = await fetch(README_URL, {
            headers: { "User-Agent": "openodia.com" },
          });
          if (!res.ok) {
            return new Response(
            JSON.stringify({ items: [], fetchedAt: new Date().toISOString(), error: "fetch_failed" }),
            {
              status: 502,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
              },
            },
          );
          }
          const md = await res.text();
          const items = parseReadme(md);

          return new Response(JSON.stringify({ items, fetchedAt: new Date().toISOString() }), {
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
          console.error("awesome parse error", e);
          return new Response(
            JSON.stringify({ items: [], fetchedAt: new Date().toISOString(), error: "parse_failed" }),
            {
              status: 500,
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
