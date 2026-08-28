/**
 * A single catalog resource, for its detail page.
 *
 * Reads the cached list first — the directories have almost always warmed it —
 * and only falls back to one upstream call for a resource the lists don't
 * carry (a curated entry pointing at a repo outside the pinned set).
 */
import { fetchWithTimeout } from "../fetch-utils";
import { normalizeSpdx } from "../license";
import { upstreamUrl, type ResourceRef } from "../resource-id";
import { cachedJson } from "./cache";
import { loadDatasets, loadModels, summarize } from "./huggingface";
import { loadRepos } from "./repos";

export type Resource = {
  kind: ResourceRef["kind"];
  id: string;
  name: string;
  author: string;
  url: string;
  description: string;
  license: string;
  /** Task / pipeline label for HF entries, primary language for repos. */
  topic: string;
  stars?: number;
  downloads?: number;
  likes?: number;
  sizeCategory?: string;
  modalities?: string[];
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
};

const TTL_MS = 60 * 60 * 1000;

type HFDetail = {
  id: string;
  pipeline_tag?: string;
  description?: string;
  cardData?: { license?: string | string[] };
  downloads?: number;
  likes?: number;
  tags?: string[];
  createdAt?: string;
  lastModified?: string;
};

type GHDetail = {
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  license?: { spdx_id?: string | null } | null;
  topics?: string[];
  created_at: string;
  updated_at: string;
};

const githubToken = process.env.GITHUB_TOKEN;

async function fetchOneRepo(id: string): Promise<Resource | null> {
  const r = await fetchWithTimeout(`https://api.github.com/repos/${id}`, {
    headers: {
      "User-Agent": "openodia.com",
      Accept: "application/vnd.github+json",
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });
  if (!r.ok) return null;
  const d = (await r.json()) as GHDetail;
  return {
    kind: "gh",
    id: d.full_name,
    name: d.name,
    author: d.full_name.split("/")[0],
    url: `https://github.com/${d.full_name}`,
    description: d.description ?? "",
    license: normalizeSpdx(d.license?.spdx_id),
    topic: d.language ?? "",
    stars: d.stargazers_count,
    tags: d.topics ?? [],
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

async function fetchOneHF(ref: ResourceRef): Promise<Resource | null> {
  const base = ref.kind === "dataset" ? "datasets" : "models";
  const r = await fetchWithTimeout(`https://huggingface.co/api/${base}/${ref.id}`, {
    headers: { "User-Agent": "openodia.com" },
  });
  if (!r.ok) return null;
  const d = (await r.json()) as HFDetail;
  const tags = d.tags ?? [];
  const cardLicense = Array.isArray(d.cardData?.license)
    ? d.cardData?.license[0]
    : d.cardData?.license;
  const tagLicense = tags.find((t) => t.startsWith("license:"))?.slice("license:".length);
  return {
    kind: ref.kind,
    id: d.id,
    name: d.id.split("/").slice(1).join("/") || d.id,
    author: d.id.split("/")[0],
    url: upstreamUrl(ref),
    description: summarize(d.description ?? "", 3),
    license: normalizeSpdx(cardLicense ?? tagLicense),
    topic: d.pipeline_tag ?? tags.find((t) => t.startsWith("task_categories:"))?.slice(16) ?? "",
    downloads: d.downloads ?? 0,
    likes: d.likes ?? 0,
    sizeCategory: tags.find((t) => t.startsWith("size_categories:"))?.slice(16) ?? "",
    modalities: tags.filter((t) => t.startsWith("modality:")).map((t) => t.slice(9)),
    tags,
    createdAt: d.createdAt,
    updatedAt: d.lastModified,
  };
}

export async function loadResource(ref: ResourceRef): Promise<Resource | null> {
  return cachedJson(`resource:${ref.kind}:${ref.id}`, TTL_MS, async () => {
    if (ref.kind === "gh") {
      const repos = await loadRepos().catch(() => []);
      const hit = repos.find((r) => r.full_name.toLowerCase() === ref.id.toLowerCase());
      if (hit) {
        return {
          kind: "gh" as const,
          id: hit.full_name,
          name: hit.name,
          author: hit.full_name.split("/")[0],
          url: hit.html_url,
          description: hit.description ?? "",
          license: normalizeSpdx(hit.license?.spdx_id),
          topic: hit.language ?? "",
          stars: hit.stargazers_count,
          tags: hit.topics ?? [],
          createdAt: hit.created_at,
          updatedAt: hit.updated_at,
        };
      }
      return fetchOneRepo(ref.id);
    }

    const page = ref.kind === "model" ? await loadModels() : await loadDatasets();
    const hit = page.items.find((i) => i.id.toLowerCase() === ref.id.toLowerCase());
    if (hit) {
      const dataset = "sizeCategory" in hit ? hit : null;
      return {
        kind: ref.kind,
        id: hit.id,
        name: hit.name,
        author: hit.author,
        url: hit.url,
        description: dataset?.description ?? "",
        license: normalizeSpdx(hit.license),
        topic: hit.task,
        downloads: hit.downloads,
        likes: hit.likes,
        sizeCategory: dataset?.sizeCategory,
        modalities: dataset?.modalities,
        tags: hit.tags,
        createdAt: hit.createdAt,
      };
    }
    return fetchOneHF(ref);
  });
}
