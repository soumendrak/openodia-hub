export const OPENAPI_SPEC = {
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
    "/api/health": {
      get: {
        summary: "Service liveness",
        description: "Checks the Worker is responding; does not check upstream data sources.",
        responses: { "200": { description: "Liveness status" } },
      },
    },
    "/api/search": {
      get: {
        summary: "Search OpenOdia",
        description:
          "Ranked resource metadata and page summaries, with source availability and snapshot timestamp. Not dataset rows or tutorial transcripts.",
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            example: "Odia",
            schema: { type: "string", maxLength: 80 },
          },
          {
            name: "kind",
            in: "query",
            description:
              "Comma-separated kinds: page, repository, tool, model, dataset, paper, tutorial, event",
            schema: { type: "string" },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 50, default: 20 },
          },
        ],
        responses: {
          "200": { description: "Results, partial, sources, and builtAt" },
          "400": { description: "Invalid query or kind" },
          "503": { description: "Search unavailable" },
        },
      },
    },
    "/mcp": {
      post: {
        summary: "OpenOdia MCP server",
        description:
          "Stateless Streamable HTTP MCP transport. Use an MCP client to initialize, list tools, and call search. Send Accept: application/json, text/event-stream. No authentication or session ID required. See /api#mcp for tool arguments.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: {
                  protocolVersion: "2025-11-25",
                  capabilities: {},
                  clientInfo: { name: "api-explorer", version: "1.0.0" },
                },
              },
              schema: {
                type: "object",
                required: ["jsonrpc", "method"],
                properties: {
                  jsonrpc: { type: "string", enum: ["2.0"] },
                  id: { oneOf: [{ type: "string" }, { type: "integer" }] },
                  method: { type: "string" },
                  params: { type: "object" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "JSON-RPC response",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "202": { description: "Notification accepted" },
          "400": { description: "Invalid JSON-RPC or protocol version" },
          "403": { description: "Origin rejected" },
          "405": { description: "Only POST and OPTIONS supported" },
          "406": { description: "Accept must allow JSON and event-stream" },
          "413": { description: "Request exceeds 16 KiB" },
          "415": { description: "Expected application/json" },
        },
      },
    },
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
          "Live, persisted and curated events in one canonical feed. Returns partial and bounded sources metadata: sourceId, outcome (success-empty/success-events/failed), eventCount, lastAttemptAt, optional lastSuccessAt, completeness flags, and a sanitized errorCategory. Fetch success does not imply complete history or registration availability.",
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
        responses: {
          "200": { description: "Events with measured source outcomes and partial flag" },
          "503": { description: "All live sources unavailable and no retained events" },
        },
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
          "Latest videos and playlists from the five community channels. Enriched with view counts when YOUTUBE_API_KEY is set. A channel whose feed is unavailable is still listed, with an empty video list.",
        responses: {
          "200": { description: "Videos and playlists" },
          "503": {
            description:
              "YouTube unreachable, or the fan-out budget expired before every channel was attempted. Body carries `channels: []` and an `error` of `youtube_unavailable` or `youtube_incomplete`; retry rather than treating it as a fault in this service.",
          },
        },
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
