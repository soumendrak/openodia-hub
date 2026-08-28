/**
 * Per-page head metadata.
 *
 * Every page needs a canonical URL and its own `og:url`: without them the
 * root's `og:url` (the bare origin) is inherited site-wide, so a shared link
 * to /models previews as the home page, and query strings from the facet UI
 * or campaign tags look like duplicate pages to a crawler.
 */

export const SITE = "https://openodia.com";

/** `""` for the home page, otherwise the path without a leading slash. */
export function canonicalUrl(path: string): string {
  return path ? `${SITE}/${path.replace(/^\/+/, "")}` : SITE;
}

export type PageMeta = {
  path: string;
  title: string;
  description: string;
  /** Defaults to `title` / `description` when the social copy is the same. */
  ogTitle?: string;
  ogDescription?: string;
  /** Extra head links, e.g. an RSS alternate. */
  links?: { rel: string; href: string; type?: string; title?: string }[];
};

export function pageHead(meta: PageMeta) {
  const url = canonicalUrl(meta.path);
  return {
    meta: [
      { title: meta.title },
      { name: "description", content: meta.description },
      { property: "og:title", content: meta.ogTitle ?? meta.title },
      { property: "og:description", content: meta.ogDescription ?? meta.description },
      { property: "og:url", content: url },
    ],
    links: [{ rel: "canonical", href: url }, ...(meta.links ?? [])],
  };
}
