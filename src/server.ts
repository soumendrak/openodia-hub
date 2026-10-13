import "./lib/error-capture";
import { OPENAPI_SPEC } from "./lib/openapi";
import { handleApiDiscovery } from "./lib/api-discovery";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { estimateTokens, htmlToMarkdown } from "./lib/html-to-markdown";
import { syncEventsToD1, type D1Like } from "./lib/events-store";
import { loadEventCollection, setEventDatabase } from "./lib/event-collection";
import { loadAwesome } from "./lib/sources/awesome";
import { loadRepos } from "./lib/sources/repos";
import { setCacheStore, setExecutionContext } from "./lib/sources/cache";
import { loadDatasets, loadModels } from "./lib/sources/huggingface";

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
    serverEntryPromise = import("./lib/ssr-entry").then(
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
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
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

async function handleEvents(env: Env | undefined, request: Request): Promise<Response> {
  const collection = await loadEventCollection(env?.EVENTS_DB);
  const { events } = collection;
  const { source, sources, partial } = collection;
  const status =
    events.length === 0 && sources.every((source) => source.outcome === "failed") ? 503 : 200;

  const url = new URL(request.url);
  const pageParam = url.searchParams.get("page");

  if (pageParam === null) {
    return new Response(JSON.stringify({ events, source, sources, partial }), {
      status,
      headers: { ...EVENTS_CORS, ...(partial ? { "Cache-Control": "no-store" } : {}) },
    });
  }

  const limit = Math.max(
    1,
    Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 50),
  );
  const pageNum = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const start = (pageNum - 1) * limit;
  const pageItems = events.slice(start, start + limit);
  const nextCursor = start + limit < events.length ? String(pageNum + 1) : undefined;

  return new Response(
    JSON.stringify({
      events: pageItems,
      nextCursor,
      total: events.length,
      source,
      sources,
      partial,
    }),
    {
      status,
      headers: { ...EVENTS_CORS, ...(partial ? { "Cache-Control": "no-store" } : {}) },
    },
  );
}

export default {
  async fetch(request: Request, env: Env | undefined, ctx: unknown) {
    // Lets cachedJson keep a background refresh alive past the response.
    setExecutionContext(ctx);
    // The globally-replicated layer behind the in-isolate memo. Without it a
    // cold isolate re-runs the whole upstream fan-out on the request path.
    setCacheStore(env?.CATALOG_KV);
    setEventDatabase(env?.EVENTS_DB);
    try {
      // URL rewrites: map dot-path URLs to TanStack Router paths
      // TanStack Router treats dots as path separators in file-based routing,
      // so llms.txt.ts → /llms/txt instead of /llms.txt
      const url = new URL(request.url);
      const originalPath = url.pathname;

      const discovery = handleApiDiscovery(request);
      if (discovery) return discovery;
      if (originalPath === "/mcp") {
        const { handleMcpRequest } = await import("./lib/mcp");
        return await handleMcpRequest(request);
      }

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

      if (originalPath === "/events-feed") {
        const { generateRssFeed } = await import("./routes/events-feed");
        const collection = await loadEventCollection(env?.EVENTS_DB);
        return new Response(generateRssFeed(collection.events, "https://openodia.com"), {
          status:
            collection.events.length === 0 &&
            collection.sources.every((source) => source.outcome === "failed")
              ? 503
              : 200,
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "X-OpenOdia-Partial": String(collection.partial),
            "Cache-Control": collection.partial ? "no-store" : "public, s-maxage=3600",
          },
        });
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
        return new Response(JSON.stringify(OPENAPI_SPEC, null, 2), {
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
    setEventDatabase(env?.EVENTS_DB);
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
