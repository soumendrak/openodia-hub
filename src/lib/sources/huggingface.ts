/**
 * Hugging Face model and dataset registries, filtered to Odia.
 *
 * Shared by `/api/models`, `/api/datasets` and the matching route loaders
 * (SSR) so both read the same list through the same cache.
 *
 * License and size come out of HF's own tag vocabulary (`license:apache-2.0`,
 * `size_categories:10K<n<100K`) — no extra round trip per entry.
 */
import { fetchWithTimeout } from "../fetch-utils";
import { cachedJson, UpstreamUnavailableError } from "./cache";

export type Model = {
  id: string;
  author: string;
  name: string;
  url: string;
  task: string;
  library: string;
  license: string;
  downloads: number;
  likes: number;
  tags: string[];
  createdAt: string;
};

export type Dataset = {
  id: string;
  author: string;
  name: string;
  url: string;
  description: string;
  task: string;
  license: string;
  /** HF `size_categories` bucket, e.g. "10K<n<100K". Empty when untagged. */
  sizeCategory: string;
  /** HF `modality` tags, e.g. ["text", "audio"]. */
  modalities: string[];
  downloads: number;
  likes: number;
  tags: string[];
  createdAt: string;
  /** HF `lastModified`. Only the datasets endpoint returns it. */
  updatedAt?: string;
};

type HFModel = {
  id: string;
  pipeline_tag?: string;
  library_name?: string;
  downloads?: number;
  likes?: number;
  tags?: string[];
  createdAt?: string;
};

type HFDataset = {
  id: string;
  description?: string;
  downloads?: number;
  likes?: number;
  tags?: string[];
  createdAt?: string;
  lastModified?: string;
};

const MODELS_URL =
  "https://huggingface.co/api/models?filter=or&limit=100&sort=downloads&direction=-1";
const DATASETS_URL =
  "https://huggingface.co/api/datasets?filter=language:or&limit=100&sort=downloads&direction=-1";
const TTL_MS = 60 * 60 * 1000;

/**
 * Page cap. Pages are sequential (each needs the previous cursor), so this is
 * also the cold-fetch latency budget: the home page's ecosystem counts wait on
 * it, and a cap that outruns their deadline makes a stat tile flicker in and
 * out. When it bites, the UI says so rather than passing the count off as a
 * total.
 */
const MAX_PAGES = 8;

/** First value of a `prefix:value` tag, or "" when the entry carries none. */
function tagValue(tags: string[], prefix: string): string {
  for (const t of tags) {
    if (t.startsWith(`${prefix}:`)) return t.slice(prefix.length + 1);
  }
  return "";
}

function tagValues(tags: string[], prefix: string): string[] {
  return tags.filter((t) => t.startsWith(`${prefix}:`)).map((t) => t.slice(prefix.length + 1));
}

/**
 * HF dataset-card descriptions are the whole card — hundreds of words with
 * markdown artifacts and boilerplate. Cards show two sentences; the full text
 * is one click away on HF.
 */
export function summarize(description: string, maxSentences = 2): string {
  const cleaned = description
    .replace(/\s*See the full description on the dataset page:.*$/is, "")
    // Headings are the card's structure, not its summary — dropping the line
    // avoids "Odia corpus This is a large Odia corpus."
    .replace(/^\s*#{1,6}[^\n]*$/gm, "")
    // Stop before a closing bracket so "(https://x)" leaves "()" to clean up,
    // not a dangling "(".
    .replace(/https?:\/\/[^\s)\]]+/g, "")
    .replace(/[*_`>|]/g, "")
    // Stripping a URL out of "built from the dumps (https://…)" leaves "( )".
    .replace(/\(\s*\)|\[\s*\]/g, "")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";

  const sentences = cleaned.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return cleaned.length > 220 ? `${cleaned.slice(0, 217)}…` : cleaned;

  const summary = sentences
    .slice(0, maxSentences)
    .map((s) => s.trim())
    .join(" ");
  return summary.length > 260 ? `${summary.slice(0, 257)}…` : summary;
}

function normalizeModel(m: HFModel): Model {
  const [author, ...rest] = m.id.split("/");
  const tags = m.tags ?? [];
  return {
    id: m.id,
    author,
    name: rest.join("/") || author,
    url: `https://huggingface.co/${m.id}`,
    task: m.pipeline_tag ?? "other",
    library: m.library_name ?? "",
    license: tagValue(tags, "license"),
    downloads: m.downloads ?? 0,
    likes: m.likes ?? 0,
    tags,
    createdAt: m.createdAt ?? "",
  };
}

function normalizeDataset(d: HFDataset): Dataset {
  const [author, ...rest] = d.id.split("/");
  const tags = d.tags ?? [];
  return {
    id: d.id,
    author,
    name: rest.join("/") || author,
    url: `https://huggingface.co/datasets/${d.id}`,
    description: summarize(d.description ?? ""),
    task: tagValue(tags, "task_categories") || "other",
    license: tagValue(tags, "license"),
    sizeCategory: tagValue(tags, "size_categories"),
    modalities: tagValues(tags, "modality"),
    downloads: d.downloads ?? 0,
    likes: d.likes ?? 0,
    tags,
    createdAt: d.createdAt ?? "",
    updatedAt: d.lastModified,
  };
}

/** HF paginates with an RFC 5988 `Link: <…>; rel="next"` header. */
function nextPage(response: Response): string | null {
  const link = response.headers.get("link");
  if (!link) return null;
  const m = /<([^>]+)>;\s*rel="next"/.exec(link);
  return m ? m[1] : null;
}

/** `truncated` means the page cap stopped us, so `items.length` is a floor. */
export type Page<T> = { items: T[]; truncated: boolean };

async function fetchHF<T>(url: string, label: string): Promise<Page<T>> {
  const all: T[] = [];
  let next: string | null = url;

  for (let page = 0; next && page < MAX_PAGES; page++) {
    const r: Response = await fetchWithTimeout(next, {
      headers: { "User-Agent": "openodia.com" },
    });
    // A later page failing after some succeeded still means an incomplete
    // count, so treat any non-OK page as a failure of the whole load.
    if (!r.ok) throw new UpstreamUnavailableError(`${label}_${r.status}`);
    all.push(...((await r.json()) as T[]));
    next = nextPage(r);
  }

  if (next) {
    console.warn(`${label}: stopped at ${MAX_PAGES} pages (${all.length} items); count is a floor`);
  }
  return { items: all, truncated: next !== null };
}

export async function loadModels(): Promise<Page<Model>> {
  return cachedJson("hf-models", TTL_MS, async () => {
    const page = await fetchHF<HFModel>(MODELS_URL, "hf_models");
    return { items: page.items.map(normalizeModel), truncated: page.truncated };
  });
}

export async function loadDatasets(): Promise<Page<Dataset>> {
  return cachedJson("hf-datasets", TTL_MS, async () => {
    const page = await fetchHF<HFDataset>(DATASETS_URL, "hf_datasets");
    return { items: page.items.map(normalizeDataset), truncated: page.truncated };
  });
}
