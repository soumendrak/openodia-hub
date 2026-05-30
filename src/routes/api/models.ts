import { createFileRoute } from "@tanstack/react-router";
import { fetchWithTimeout } from "../../lib/fetch-utils";

type HFModel = {
  id: string;
  pipeline_tag?: string;
  library_name?: string;
  downloads?: number;
  likes?: number;
  tags?: string[];
  createdAt?: string;
};

type Model = {
  id: string;
  author: string;
  name: string;
  url: string;
  task: string;
  library: string;
  downloads: number;
  likes: number;
  tags: string[];
  createdAt: string;
};

const HF_URL = "https://huggingface.co/api/models?filter=or&limit=200&sort=downloads&direction=-1";

function normalize(m: HFModel): Model {
  const [author, ...rest] = m.id.split("/");
  const name = rest.join("/") || author;
  return {
    id: m.id,
    author,
    name,
    url: `https://huggingface.co/${m.id}`,
    task: m.pipeline_tag ?? "other",
    library: m.library_name ?? "",
    downloads: m.downloads ?? 0,
    likes: m.likes ?? 0,
    tags: m.tags ?? [],
    createdAt: m.createdAt ?? "",
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

export const Route = createFileRoute("/api/models")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const r = await fetchWithTimeout(HF_URL, {
            headers: { "User-Agent": "openodia.com" },
          });
          if (!r.ok) {
            return buildResponse(
              { models: [], fetchedAt: new Date().toISOString(), error: "fetch_failed" },
              200,
              false,
            );
          }
          const raw = (await r.json()) as HFModel[];
          const models = raw.map(normalize);
          return buildResponse({ models, fetchedAt: new Date().toISOString() }, 200);
        } catch (e) {
          console.error("models error", e);
          return buildResponse(
            { models: [], fetchedAt: new Date().toISOString(), error: "internal_error" },
            200,
            false,
          );
        }
      },
    },
  },
});
