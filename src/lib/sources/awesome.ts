/**
 * Awesome-Odia-AI README parsing and fetching.
 *
 * Shared by `/api/awesome` and the /tools route loader (SSR) so both read the
 * same list through the same cache.
 */
import { fetchWithTimeout } from "../fetch-utils";
import { cachedJson, UpstreamUnavailableError } from "./cache";

export type Item = {
  category: string;
  subcategory?: string;
  name: string;
  url: string;
  description: string;
};

const README_URL = "https://raw.githubusercontent.com/odisha-ml/Awesome-Odia-AI/main/README.md";
const TTL_MS = 60 * 60 * 1000;

/**
 * Some catalogs write their links as HTML anchors rather than markdown.
 * Normalising to markdown first means one parser covers both.
 */
function htmlLinksToMarkdown(line: string): string {
  return line.replace(
    /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_all, href: string, text: string) =>
      `[${text.replace(/<[^>]+>/g, "").trim()}](${href.trim()})`,
  );
}

export function parseReadme(md: string): Item[] {
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
    // Both bullet characters are in use: Awesome-Odia-AI writes 100 rows with
    // "-" and 70 with "*", and the Odia-NLP-Resource-Catalog uses "*"
    // throughout. Accepting only "-" silently dropped 41% of the curated list.
    if (!/^[-*]\s/.test(line)) continue;
    const body = htmlLinksToMarkdown(line.slice(1).trim());

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

    // clean description: drop images and link badges, strip leftover brackets
    desc = desc
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      // Trailing "[[paper](url)][[code](url)]" badge clusters are links, not
      // prose — drop them whole. `[^)]*` (not `+`) so an empty target like
      // "[code]()" goes too, instead of leaving a "code()" artifact behind.
      .replace(/\[\s*[^\]]*?\s*\]\([^)]*\)/g, "")
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

export async function loadAwesome(): Promise<Item[]> {
  return cachedJson("awesome", TTL_MS, async () => {
    const r = await fetchWithTimeout(README_URL, { headers: { "User-Agent": "openodia.com" } });
    if (!r.ok) throw new UpstreamUnavailableError(`awesome_readme_${r.status}`);
    const items = parseReadme(await r.text());
    if (items.length === 0) throw new UpstreamUnavailableError("awesome_readme_empty");
    return items;
  });
}
