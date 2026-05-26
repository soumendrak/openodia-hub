import { createFileRoute } from "@tanstack/react-router";
import { fetchWithTimeout } from "../../lib/fetch-utils";

type HFDataset = {
  id: string;
  description?: string;
  downloads?: number;
  likes?: number;
  tags?: string[];
  createdAt?: string;
  // Present when ?full=true. All three default to false in normal cases.
  disabled?: boolean;
  gated?: boolean | string;
  private?: boolean;
};

type Dataset = {
  id: string;
  author: string;
  name: string;
  url: string;
  description: string;
  task: string;
  downloads: number;
  likes: number;
  tags: string[];
  createdAt: string;
  // Heuristic: datasets-server has a viewer for ~all non-gated, non-private,
  // non-disabled datasets. Not perfect — some still fail because the server
  // hasn't processed them — but it filters out the obvious "no preview"
  // cases so users don't click hopelessly.
  previewable: boolean;
};

const HF_URL =
  "https://huggingface.co/api/datasets?filter=language:or&limit=200&sort=downloads&direction=-1&full=true";

// task_categories tags look like "task_categories:translation". Extract the
// first one we find as the headline task; default to "other".
function extractTask(tags: string[]): string {
  for (const t of tags) {
    if (t.startsWith("task_categories:")) return t.slice("task_categories:".length);
  }
  return "other";
}

function normalize(d: HFDataset): Dataset {
  const [author, ...rest] = d.id.split("/");
  const name = rest.join("/") || author;
  return {
    id: d.id,
    author,
    name,
    url: `https://huggingface.co/datasets/${d.id}`,
    description: d.description ?? "",
    task: extractTask(d.tags ?? []),
    downloads: d.downloads ?? 0,
    likes: d.likes ?? 0,
    tags: d.tags ?? [],
    createdAt: d.createdAt ?? "",
    previewable: !(d.disabled || d.gated || d.private),
  };
}

function buildResponse(body: unknown, status: number, cache = true) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, User-Agent",
  };
  if (cache) {
    headers["Cache-Control"] = "public, s-maxage=3600, stale-while-revalidate=86400";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export const Route = createFileRoute("/api/datasets")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const r = await fetchWithTimeout(HF_URL, {
            headers: { "User-Agent": "openodia.com" },
          });
          if (!r.ok) {
            return buildResponse(
              { datasets: [], fetchedAt: new Date().toISOString(), error: "fetch_failed" },
              200,
              false,
            );
          }
          const raw = (await r.json()) as HFDataset[];
          const datasets = raw.map(normalize);
          return buildResponse({ datasets, fetchedAt: new Date().toISOString() }, 200);
        } catch (e) {
          console.error("datasets error", e);
          return buildResponse(
            { datasets: [], fetchedAt: new Date().toISOString(), error: "internal_error" },
            200,
            false,
          );
        }
      },
    },
  },
});
