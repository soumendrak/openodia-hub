import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

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

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // URL rewrites: map dot-path URLs to TanStack Router paths
      // TanStack Router treats dots as path separators in file-based routing,
      // so llms.txt.ts → /llms/txt instead of /llms.txt
      const url = new URL(request.url);
      const originalPath = url.pathname;

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
                responses: { "200": { description: "Array of categorized items" } },
              },
            },
            "/api/events": {
              get: {
                summary: "Community events",
                responses: { "200": { description: "Array of events" } },
              },
            },
            "/api/pypi": {
              get: {
                summary: "OpenOdia PyPI package info",
                responses: { "200": { description: "Package metadata" } },
              },
            },
            "/api/repos": {
              get: {
                summary: "GitHub repositories",
                responses: { "200": { description: "Repository list" } },
              },
            },
            "/api/videos": {
              get: {
                summary: "YouTube videos",
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
