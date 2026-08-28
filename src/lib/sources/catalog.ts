/**
 * The unified catalog: one normalised record per resource, across all sources.
 *
 * The three source lists overlap — a curated Awesome-Odia-AI row and the
 * GitHub repo it points at are the same thing. Records are keyed by the
 * permalink derived from the URL, so those merge into one entry that keeps the
 * curated description (hand-written) and the upstream metrics (live).
 *
 * This is what `/api/resources` serves: the machine-readable catalog that a
 * notebook or a downstream tool can consume without scraping the pages.
 */
import { licenseFromProse, normalizeSpdx } from "../license";
import { refFromUrl, refToPath, type ResourceKind } from "../resource-id";
import { loadAwesome } from "./awesome";
import { loadExternalCatalogs } from "./catalogs";
import { loadDatasets, loadModels } from "./huggingface";
import { loadRepos } from "./repos";

export type CatalogKind = ResourceKind | "link";

export type CatalogEntry = {
  /** Stable key: the permalink path, or the URL for entries with no permalink. */
  key: string;
  kind: CatalogKind;
  name: string;
  author: string;
  /** Upstream URL. */
  url: string;
  /** Permalink on openodia.com, when the resource has a detail page. */
  permalink?: string;
  description: string;
  license: string;
  /** Task, pipeline tag, or category, depending on the source. */
  task: string;
  category?: string;
  sizeCategory?: string;
  language?: string;
  stars?: number;
  downloads?: number;
  likes?: number;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
  /** Which upstreams contributed to this record. */
  sources: string[];
};

/** Curated prose wins over generated blurbs; live metrics win over nothing. */
function merge(base: CatalogEntry, next: CatalogEntry): CatalogEntry {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(next).filter(([k, v]) => {
        if (k === "sources" || k === "description") return false;
        return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
      }),
    ),
    description: base.description || next.description,
    sources: [...new Set([...base.sources, ...next.sources])],
  };
}

export async function loadCatalog(): Promise<CatalogEntry[]> {
  const [awesome, external, repos, models, datasets] = await Promise.allSettled([
    loadAwesome(),
    loadExternalCatalogs(),
    loadRepos(),
    loadModels(),
    loadDatasets(),
  ]);

  const byKey = new Map<string, CatalogEntry>();
  const add = (entry: CatalogEntry) => {
    const existing = byKey.get(entry.key);
    byKey.set(entry.key, existing ? merge(existing, entry) : entry);
  };

  if (awesome.status === "fulfilled") {
    for (const a of awesome.value) {
      const ref = refFromUrl(a.url);
      add({
        key: ref ? refToPath(ref) : a.url,
        kind: ref?.kind ?? "link",
        name: a.name,
        author: ref?.id.split("/")[0] ?? "",
        url: a.url,
        permalink: ref ? refToPath(ref) : undefined,
        description: a.description,
        license: licenseFromProse(a.description),
        task: a.subcategory ?? a.category,
        category: a.category,
        tags: [],
        sources: ["awesome-odia-ai"],
      });
    }
  }

  // The other Odia catalogs. Entries that resolve to the same permalink merge
  // into the record already there, so a resource listed in three places shows
  // all three under `sources` instead of appearing three times.
  if (external.status === "fulfilled") {
    for (const { catalog, items } of external.value) {
      for (const item of items) {
        const ref = refFromUrl(item.url);
        add({
          key: ref ? refToPath(ref) : item.url,
          kind: ref?.kind ?? "link",
          name: item.name,
          author: ref?.id.split("/")[0] ?? "",
          url: item.url,
          permalink: ref ? refToPath(ref) : undefined,
          description: item.description,
          license: licenseFromProse(item.description),
          task: item.subcategory ?? item.category,
          category: item.category,
          tags: [],
          sources: [catalog.id],
        });
      }
    }
  }

  if (repos.status === "fulfilled") {
    for (const r of repos.value) {
      const permalink = refToPath({ kind: "gh", id: r.full_name });
      add({
        key: permalink,
        kind: "gh",
        name: r.name,
        author: r.full_name.split("/")[0],
        url: r.html_url,
        permalink,
        description: r.description ?? "",
        license: normalizeSpdx(r.license?.spdx_id),
        task: "",
        language: r.language ?? undefined,
        stars: r.stargazers_count,
        tags: r.topics ?? [],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        sources: ["github"],
      });
    }
  }

  if (models.status === "fulfilled") {
    for (const m of models.value.items) {
      const permalink = refToPath({ kind: "model", id: m.id });
      add({
        key: permalink,
        kind: "model",
        name: m.name,
        author: m.author,
        url: m.url,
        permalink,
        description: "",
        license: normalizeSpdx(m.license),
        task: m.task,
        downloads: m.downloads,
        likes: m.likes,
        tags: m.tags,
        createdAt: m.createdAt,
        sources: ["huggingface"],
      });
    }
  }

  if (datasets.status === "fulfilled") {
    for (const d of datasets.value.items) {
      const permalink = refToPath({ kind: "dataset", id: d.id });
      add({
        key: permalink,
        kind: "dataset",
        name: d.name,
        author: d.author,
        url: d.url,
        permalink,
        description: d.description,
        license: normalizeSpdx(d.license),
        task: d.task,
        sizeCategory: d.sizeCategory,
        downloads: d.downloads,
        likes: d.likes,
        tags: d.tags,
        createdAt: d.createdAt,
        sources: ["huggingface"],
      });
    }
  }

  if (byKey.size === 0) {
    throw new Error("every catalog source failed");
  }
  return [...byKey.values()];
}

export type CatalogQuery = {
  kind?: string;
  license?: string;
  author?: string;
  q?: string;
  limit: number;
  offset: number;
};

export function queryCatalog(entries: CatalogEntry[], query: CatalogQuery) {
  const needle = query.q?.trim().toLowerCase();
  const filtered = entries.filter((e) => {
    if (query.kind && e.kind !== query.kind) return false;
    if (query.license && e.license.toLowerCase() !== query.license.toLowerCase()) return false;
    if (query.author && e.author.toLowerCase() !== query.author.toLowerCase()) return false;
    if (!needle) return true;
    return (
      e.name.toLowerCase().includes(needle) ||
      e.description.toLowerCase().includes(needle) ||
      e.task.toLowerCase().includes(needle) ||
      e.tags.some((t) => t.toLowerCase().includes(needle))
    );
  });

  return {
    total: filtered.length,
    offset: query.offset,
    limit: query.limit,
    resources: filtered.slice(query.offset, query.offset + query.limit),
  };
}
