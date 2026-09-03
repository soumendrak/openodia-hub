import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { estimateTokens, htmlToMarkdown } from "./lib/html-to-markdown";
import { readEventsFromD1, syncEventsToD1, type D1Like } from "./lib/events-store";
import { CHAPTERS, fetchChapterEvents } from "./routes/api/events";
import { settledValues } from "./lib/fetch-utils";
import { dedupeEventsByResolvedUrl, dedupeEventsByUrl } from "./lib/event-url";
import { loadAwesome } from "./lib/sources/awesome";
import { loadRepos } from "./lib/sources/repos";
import { setCacheStore, setExecutionContext } from "./lib/sources/cache";
import { loadDatasets, loadModels } from "./lib/sources/huggingface";
import type { Event } from "./data/events/types";

type KVRead = { get: (key: string) => Promise<string | null> };
type KVReadWrite = KVRead & {
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
};
type Env = {
  CONTRIBUTORS_KV?: KVRead;
  /** Global store behind cachedJson — see lib/sources/cache. */
  CATALOG_KV?: KVReadWrite;
  EVENTS_DB?: D1Like;
};

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

const CONTRIBUTORS_KV_KEY = "contributors:v2";
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

// RFC 8288 Link headers so agents can find the machine-readable surface from any
// HTML page without guessing paths. Relations are IANA-registered.
const AGENT_LINK_HEADER = [
  '</.well-known/openapi.json>; rel="service-desc"; type="application/json"',
  '</api>; rel="service-doc"; type="text/html"',
  '</llms.txt>; rel="alternate"; type="text/plain"',
].join(", ");

export function withAgentLinks(response: Response): Response {
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return response;
  const headers = new Headers(response.headers);
  headers.append("Link", AGENT_LINK_HEADER);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function acceptHtml(headers: Headers): Headers {
  const next = new Headers(headers);
  next.set("accept", "text/html");
  return next;
}

export function wantsMarkdown(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  return (request.headers.get("accept") ?? "")
    .split(",")
    .some((part) => part.trim().toLowerCase().startsWith("text/markdown"));
}

/**
 * TanStack Start hard-500s any Accept it does not recognise
 * (`{"error":"Only HTML requests are supported here"}` — see
 * @tanstack/start-server-core createStartHandler). Render as HTML, then convert
 * the result, so `Accept: text/markdown` gets a page instead of an error.
 */
export async function toMarkdownResponse(response: Response): Promise<Response> {
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return response;

  const markdown = htmlToMarkdown(await response.text());
  const headers = new Headers(response.headers);
  headers.set("content-type", "text/markdown; charset=utf-8");
  headers.set("x-markdown-tokens", String(estimateTokens(markdown)));
  headers.delete("content-length");

  // HTML and markdown share a URL, so caches must key on Accept.
  const vary = headers.get("vary") ?? "";
  if (!/(^|,)\s*accept\s*(,|$)/i.test(vary)) {
    headers.set("vary", vary ? `${vary}, Accept` : "Accept");
  }

  return new Response(markdown, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleContributors(env: Env | undefined): Promise<Response> {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, User-Agent",
  };
  const cached = env?.CONTRIBUTORS_KV ? await env.CONTRIBUTORS_KV.get(CONTRIBUTORS_KV_KEY) : null;
  return new Response(cached ?? EMPTY_CONTRIBUTORS_BODY, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      ...cors,
    },
  });
}

const EVENTS_CORS = {
  "Content-Type": "application/json",
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, User-Agent",
};

async function liveScrapeEvents(): Promise<Event[]> {
  const settled = await Promise.allSettled(
    CHAPTERS.map((c) => fetchChapterEvents(c.community, c.slug)),
  );
  return dedupeEventsByUrl(settledValues(settled).flat());
}

async function handleEvents(env: Env | undefined, request: Request): Promise<Response> {
  let events: Event[] = [];
  let source: "d1" | "scrape" = "scrape";

  if (env?.EVENTS_DB) {
    try {
      events = await readEventsFromD1(env.EVENTS_DB);
      if (events.length > 0) source = "d1";
    } catch (err) {
      console.warn("EVENTS_DB read failed; falling back to live scrape", err);
    }
  }

  if (events.length === 0) {
    events = await liveScrapeEvents();
    source = "scrape";
  }

  // Also protects reads from databases populated before canonical URL IDs were
  // introduced; legacy duplicate rows disappear immediately at the API edge.
  events = await dedupeEventsByResolvedUrl(events);

  const url = new URL(request.url);
  const pageParam = url.searchParams.get("page");

  if (pageParam === null) {
    return new Response(JSON.stringify({ events, source }), {
      status: 200,
      headers: EVENTS_CORS,
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 50);
  const pageNum = parseInt(pageParam || "1", 10) || 1;
  const start = (pageNum - 1) * limit;
  const pageItems = events.slice(start, start + limit);
  const nextCursor = start + limit < events.length ? String(pageNum + 1) : undefined;

  return new Response(
    JSON.stringify({ events: pageItems, nextCursor, total: events.length, source }),
    { status: 200, headers: EVENTS_CORS },
  );
}

export default {
  async fetch(request: Request, env: Env | undefined, ctx: unknown) {
    // Lets cachedJson keep a background refresh alive past the response.
    setExecutionContext(ctx);
    // The globally-replicated layer behind the in-isolate memo. Without it a
    // cold isolate re-runs the whole upstream fan-out on the request path.
    setCacheStore(env?.CATALOG_KV);
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

      // Served from D1 (populated daily by the scheduled handler below).
      // Falls back to live Bevy scrape if the DB is unavailable or empty.
      if (originalPath === "/api/events") {
        return await handleEvents(env, request);
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
                  "Curated open-source Odia tools, datasets, and models parsed from the Awesome-Odia-AI README. Returns the full list; use /api/resources for filtering and pagination.",
                responses: {
                  "200": { description: "Array of categorized items" },
                  "503": { description: "The README is unreachable" },
                },
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
                  "Live registry of models tagged for Odia on Hugging Face. Returns normalized fields (author, name, task, license, downloads, likes, tags) and a `truncated` flag when the page cap stopped the fetch, in which case the count is a floor.",
                responses: {
                  "200": { description: "Array of models" },
                  "503": { description: "Hugging Face unreachable" },
                },
              },
            },
            "/api/datasets": {
              get: {
                summary: "Odia datasets",
                description:
                  "Live browser of datasets with `language:or` on Hugging Face. Returns normalized fields including task category, SPDX license, size bucket, and modalities, plus a `truncated` flag when the page cap stopped the fetch.",
                responses: {
                  "200": { description: "Array of datasets" },
                  "503": { description: "Hugging Face unreachable" },
                },
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
                  "The curated set of Odia GitHub repositories. Returns the full list; there is no pagination.",
                responses: {
                  "200": { description: "Repository list" },
                  "503": { description: "GitHub unreachable or rate-limiting" },
                },
              },
            },
            "/api/resources": {
              get: {
                summary: "Unified catalog",
                description:
                  "One normalised record per resource across every source, deduplicated by permalink — a curated Awesome-Odia-AI entry and the repo it points at are one record, not two. This is the machine-readable catalog: stable `permalink`, SPDX `license`, `task`, `sizeCategory`, and the `sources` that contributed each record.",
                parameters: [
                  {
                    name: "kind",
                    in: "query",
                    description: "Filter by resource type.",
                    schema: { type: "string", enum: ["gh", "model", "dataset", "link"] },
                  },
                  {
                    name: "license",
                    in: "query",
                    description: "Exact SPDX id, e.g. `Apache-2.0`.",
                    schema: { type: "string" },
                  },
                  {
                    name: "author",
                    in: "query",
                    description: "Owning account or organisation, e.g. `OdiaGenAI`.",
                    schema: { type: "string" },
                  },
                  {
                    name: "q",
                    in: "query",
                    description: "Free-text match over name, description, task, and tags.",
                    schema: { type: "string" },
                  },
                  {
                    name: "limit",
                    in: "query",
                    schema: { type: "integer", maximum: 200, default: 50 },
                  },
                  { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
                ],
                responses: {
                  "200": { description: "`{ resources, total, limit, offset, fetchedAt }`" },
                  "503": { description: "Every upstream source is unreachable" },
                },
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

      // Ask the SSR handler for HTML even when the agent asked for markdown —
      // it rejects any other Accept outright — and convert on the way out.
      const markdown = wantsMarkdown(request);
      const ssrRequest = markdown
        ? new Request(rewrittenRequest, { headers: acceptHtml(rewrittenRequest.headers) })
        : rewrittenRequest;

      const handler = await getServerEntry();
      const response = await handler.fetch(ssrRequest, env, ctx);
      const html = withAgentLinks(await normalizeCatastrophicSsrResponse(response));
      return markdown ? await toMarkdownResponse(html) : html;
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },

  // Cloudflare cron trigger (configured in wrangler.jsonc, every 6h). Warms the
  // catalog cache and refreshes EVENTS_DB from Bevy so the request path never
  // has to fan out or scrape.
  async scheduled(_event: unknown, env: Env | undefined, ctx: unknown): Promise<void> {
    setExecutionContext(ctx);
    setCacheStore(env?.CATALOG_KV);
    // Refresh the catalog sources into KV. This used to warm `caches.default`,
    // which is per-colo — so it only ever helped the one colo the cron happened
    // to run in, and every other colo still paid the full GitHub + Hugging Face
    // fan-out on the request path. KV is replicated, so one run warms all of
    // them, and the home page's ecosystem counts stop hitting their deadline.
    await Promise.allSettled(
      [
        ["awesome", loadAwesome],
        ["repos", loadRepos],
        ["hf-models", loadModels],
        ["hf-datasets", loadDatasets],
      ].map(async ([label, load]) => {
        try {
          await (load as () => Promise<unknown>)();
        } catch (err) {
          console.warn(`cache warm ${label as string} failed`, err);
        }
      }),
    );

    if (!env?.EVENTS_DB) {
      console.warn("scheduled: EVENTS_DB not bound; skipping events sync");
      return;
    }
    try {
      const result = await syncEventsToD1(env.EVENTS_DB);
      console.log(`events sync: ${result.upserted} upserted`);
    } catch (err) {
      console.error("events sync failed", err);
    }
  },
};
