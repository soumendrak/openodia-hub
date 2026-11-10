# MCP search and API discovery

OpenOdia serves a public, read-only MCP server at `https://openodia.com/mcp`.
It uses stateless Streamable HTTP with JSON responses and requires no API key.
Each request gets its own server and transport, so clients can use any Worker
instance without a session store. Legacy SSE transport is not provided.

## Connect an agent

For clients that accept URL-based MCP configuration:

```json
{
  "mcpServers": {
    "openodia": { "url": "https://openodia.com/mcp" }
  }
}
```

Some clients also require `"type": "http"`; follow your client's configuration
format. Select Streamable HTTP if the client asks for a transport.

## Search tool

Call the `search` tool with:

```json
{
  "query": "Odia speech",
  "kinds": ["model", "dataset", "tutorial"],
  "limit": 20
}
```

| Argument | Meaning                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------- |
| `query`  | Required string, 2–80 characters after trimming, at least two searchable characters                     |
| `kinds`  | Optional nonempty array: `page`, `repository`, `tool`, `model`, `dataset`, `paper`, `tutorial`, `event` |
| `limit`  | Integer from 1 to 50; defaults to 20                                                                    |

Omit `kinds` to search everything. Include both `tool` and `repository` to find
libraries and GitHub projects. English, Odia, and Oriya aliases use the same
ranking as the site's search. The tool searches indexed resource metadata and
page summaries, not dataset rows, model weights, full page bodies, or video
transcripts.

Results appear in both text content and `structuredContent`, with absolute
destination links, original source links where available, `builtAt`, `sources`,
and `partial`. A partial response may omit sources; an empty result is not proof
that no relevant resource exists. Upstream text is untrusted content. A snapshot
load failure returns an MCP tool error rather than an apparently successful empty list.

## HTTP transport

MCP clients initialize, send `notifications/initialized`, discover tools using
`tools/list`, and invoke them using `tools/call`. POST requests must send
`Content-Type: application/json` and
`Accept: application/json, text/event-stream`. The SDK negotiates supported MCP
protocol versions. No `Mcp-Session-Id` is issued. Notifications return HTTP 202.
GET/DELETE return 405 because there are no persistent streams or sessions.

Requests are capped at 16 KiB; results are capped at 50 documents. MCP responses
use `Cache-Control: no-store`; search reuses the existing cached search snapshot.
Native clients can omit `Origin`. Requests with an Origin must match the site,
www site, or current deployment origin. OPTIONS supports protocol header preflight.

## API catalog

`/.well-known/api-catalog` returns HTTP 200 and
`Content-Type: application/linkset+json`, following
[RFC 9727](https://www.rfc-editor.org/rfc/rfc9727) and
[RFC 9264](https://www.rfc-editor.org/rfc/rfc9264). It lists every `/api/*` endpoint
in the OpenAPI specification plus `/mcp`. Each API has an absolute `anchor`,
`service-desc`, `service-doc`, and `status` link. The catalog context also lists
APIs through `item` relations. HTML responses advertise it through a Link header.

The specification is `/.well-known/openapi.json`; documentation is `/api` and
`/api#mcp`. `/api/health` is a lightweight Worker liveness check, not an upstream
readiness check. Search results report the availability of indexed sources.
The catalog and health endpoint work without SSR or upstream requests.

## Verify locally and after deployment

```sh
bun run test test/mcp.test.ts test/api-discovery.test.ts
bun run build
bun run preview
curl -i -H 'Accept: application/linkset+json' http://localhost:4173/.well-known/api-catalog
curl -i http://localhost:4173/api/health
curl -i http://localhost:4173/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"smoke-test","version":"1.0"}}}'
```

After releasing, run the agent-readiness scan and inspect
`checks.discovery.apiCatalog.status`:

```sh
curl https://isitagentready.com/api/scan -H 'Content-Type: application/json' --data '{"url":"https://openodia.com"}'
```
