import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type KVRead = { get: (key: string) => Promise<string | null> };
type Env = {
  CONTRIBUTORS_KV?: KVRead;
};

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

const CONTRIBUTORS_KV_KEY = "contributors:v1";
const EMPTY_CONTRIBUTORS_BODY = JSON.stringify({
  contributors: [],
  totalContributors: 0,
  fetchedAt: new Date(0).toISOString(),
  error: "warming_up",
});

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

async function handleContributors(env: Env): Promise<Response> {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, User-Agent",
  };
  const cached = env.CONTRIBUTORS_KV ? await env.CONTRIBUTORS_KV.get(CONTRIBUTORS_KV_KEY) : null;
  return new Response(cached ?? EMPTY_CONTRIBUTORS_BODY, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      ...cors,
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: unknown) {
    try {
      // URL rewrites: map dot-path URLs to TanStack Router paths
      // TanStack Router treats dots as path separators in file-based routing,
      // so llms.txt.ts → /llms/txt instead of /llms.txt
      const url = new URL(request.url);
      const originalPath = url.pathname;

      // Served from KV (populated by .github/workflows/sync-contributors.yml).
      // Kept out of TanStack routes so the handler can reach env bindings.
      if (originalPath === "/api/contributors") {
        return await handleContributors(env);
      }

      // /projects merged into /tools — preserve link equity with a 301.
      if (originalPath === "/projects") {
        return Response.redirect(`${url.origin}/tools`, 301);
      }

      // Handle .well-known routes at the workers level — TanStack Router ignores
      // files/directories starting with a dot (hidden files convention)
      if (originalPath === "/.well-known/ai-plugin.json") {
        const manifest = {
          schema_version: "v1",
          name_for_model: "openodia",
          name_for_human: "OpenOdia",
          description_for_model:
            "OpenOdia is a hub for Odia language open-source. Use it to find Odia AI tools, datasets, models, YouTube tutorials, GitHub projects, community events, and PyPI packages. It aggregates resources from the OdishaAI community and the Awesome-Odia-AI directory.",
          description_for_human:
            "Open source tools, datasets, and resources for the Odia language.",
          api: {
            type: "openapi",
            url: "https://openodia.com/.well-known/openapi.json",
            has_user_authentication: false,
          },
          auth: { type: "none" },
          logo_url: "https://openodia.com/openodia-logo.svg",
          contact_email: "soumendra.s@outlook.com",
          legal_info_url: "https://github.com/soumendrak/openodia-hub/blob/main/LICENSE",
        };
        return new Response(JSON.stringify(manifest, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      if (originalPath === "/.well-known/openapi.json") {
        const spec = {
          openapi: "3.0.0",
          info: {
            title: "OpenOdia API",
            version: "1.0.0",
            description: "Public API for OpenOdia — Odia language open-source resources.",
            contact: {
              name: "Soumendra Kumar Sahoo",
              url: "https://www.soumendrak.com",
              email: "soumendra.s@outlook.com",
            },
          },
          servers: [{ url: "https://openodia.com", description: "Production" }],
          paths: {
            "/api/awesome": {
              get: {
                summary: "Awesome-Odia-AI directory",
                description:
                  "Curated open-source Odia tools, datasets, and models parsed from the Awesome-Odia-AI README. Supports cursor pagination.",
                parameters: [
                  {
                    name: "cursor",
                    in: "query",
                    schema: { type: "string" },
                    description: "Numeric offset returned as nextCursor.",
                  },
                  {
                    name: "limit",
                    in: "query",
                    schema: { type: "integer", maximum: 50, default: 30 },
                  },
                ],
                responses: { "200": { description: "Array of categorized items" } },
              },
            },
            "/api/community": {
              get: {
                summary: "GitHub Discussions",
                description:
                  "Recent discussions on the OpenOdia repo grouped by category. Falls back to an empty payload (never 5xx) when discussions are unavailable.",
                responses: { "200": { description: "Categories with their discussions" } },
              },
            },
            "/api/contributors": {
              get: {
                summary: "Contributors leaderboard",
                description:
                  "Aggregated contributors across the OpenOdia orgs, populated daily by a GitHub Action writing to KV. Returns an empty list while KV is warming up.",
                responses: { "200": { description: "Aggregated contributor list" } },
              },
            },
            "/api/events": {
              get: {
                summary: "Community events",
                description:
                  "Live + static event feed (GDG/GDGoC chapters scraped from Bevy, merged with the curated archive).",
                parameters: [
                  {
                    name: "page",
                    in: "query",
                    schema: { type: "integer", default: 1 },
                  },
                  {
                    name: "limit",
                    in: "query",
                    schema: { type: "integer", maximum: 50, default: 20 },
                  },
                ],
                responses: { "200": { description: "Array of events" } },
              },
            },
            "/api/models": {
              get: {
                summary: "Odia AI models",
                description:
                  "Live registry of models tagged for Odia on Hugging Face. Returns normalized fields (author, name, task, downloads, likes, tags).",
                responses: { "200": { description: "Array of models" } },
              },
            },
            "/api/datasets": {
              get: {
                summary: "Odia datasets",
                description:
                  "Live browser of datasets with `language:or` on Hugging Face. Returns normalized fields including extracted task category.",
                responses: { "200": { description: "Array of datasets" } },
              },
            },
            "/api/pypi": {
              get: {
                summary: "OpenOdia PyPI package info",
                description: "Version, summary, and release count for the openodia PyPI package.",
                responses: { "200": { description: "Package metadata" } },
              },
            },
            "/api/repos": {
              get: {
                summary: "GitHub repositories",
                description:
                  "Repos across the OpenOdia orgs, users, and pinned repos. Supports cursor pagination.",
                parameters: [
                  {
                    name: "cursor",
                    in: "query",
                    schema: { type: "string" },
                  },
                  {
                    name: "limit",
                    in: "query",
                    schema: { type: "integer", maximum: 50, default: 24 },
                  },
                ],
                responses: { "200": { description: "Repository list" } },
              },
            },
            "/api/roadmap": {
              get: {
                summary: "Public roadmap",
                description:
                  "Issues on the openodia-hub repo grouped by roadmap:planned, roadmap:in-progress, and roadmap:completed labels.",
                responses: { "200": { description: "Roadmap groups" } },
              },
            },
            "/api/videos": {
              get: {
                summary: "YouTube videos",
                description:
                  "Latest videos and playlists from the OpenOdia and partner channels. Enriched with view counts when YOUTUBE_API_KEY is set.",
                responses: { "200": { description: "Videos and playlists" } },
              },
            },
            "/events-feed": {
              get: {
                summary: "Events RSS feed",
                responses: { "200": { description: "RSS XML feed" } },
              },
            },
            "/llms.txt": {
              get: {
                summary: "llms.txt agent context",
                responses: { "200": { description: "Plain text" } },
              },
            },
            "/llms-full.txt": {
              get: {
                summary: "llms-full.txt full context",
                responses: { "200": { description: "Plain text" } },
              },
            },
          },
        };
        return new Response(JSON.stringify(spec, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      if (originalPath === "/llms.txt") {
        url.pathname = "/llms/txt";
      } else if (originalPath === "/llms-full.txt") {
        url.pathname = "/llms-full/txt";
      } else if (originalPath === "/sitemap.xml") {
        url.pathname = "/sitemap/xml";
      }

      const rewrittenRequest =
        url.pathname !== originalPath ? new Request(url.toString(), request) : request;

      const handler = await getServerEntry();
      const response = await handler.fetch(rewrittenRequest, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
