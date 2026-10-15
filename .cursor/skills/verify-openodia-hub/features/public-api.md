# Public API

JSON and markdown endpoints served by the Worker.

## Sub-features

- `/api/health` liveness, `/api/contributors`, `/.well-known/api-catalog` (RFC 9727 linkset), `/mcp` (MCP over POST JSON-RPC; GET is 405)
- `/api/` index, `/api/resources`, `/api/search`, `/api/events`, `/api/models`, `/api/datasets`, `/api/repos`, `/api/videos`, `/api/awesome`, `/api/pypi`, `/api/translation-status`
- Markdown negotiation with `Accept: text/markdown`

## How to get to it (user POV)

`/api` page in the footer, or direct HTTP.

## Driving it with curl

```bash
P="${VERIFY_PORT:-9171}"; E="${VERIFY_EVIDENCE:-${VERIFY_DIR:-/tmp/verify-openodia-hub}/evidence}"; B="http://127.0.0.1:$P"
curl -sS -D "$E/api-resources.headers" "$B/api/resources?q=sua" -o "$E/api-resources.json"
curl -sS -D "$E/tools-md.headers" -H 'Accept: text/markdown' "$B/tools" -o "$E/tools.md"
curl -sS -D "$E/health.headers" "$B/api/health" -o "$E/health.json"
curl -sS -D "$E/contributors.headers" "$B/api/contributors" -o "$E/contributors.json"
curl -sS -D "$E/api-catalog.headers" "$B/.well-known/api-catalog" -o "$E/api-catalog.json"
for ep in awesome datasets events models pypi repos "search?q=sua" translation-status videos; do f="$(echo "$ep" | tr -c 'a-z0-9\n' '_')"; curl -sS -m 15 -D "$E/api-$f.headers" "$B/api/$ep" -o "$E/api-$f.json"; done
curl -sS -m 15 -o /dev/null -w '/api/ %{http_code} -> %{redirect_url}\n' "$B/api/"
curl -sS -D "$E/mcp.headers" -X POST -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' "$B/mcp" -o "$E/mcp-tools.json"
```

Proof (headers files hold status, `Content-Type`, CORS and cache headers):

- `/api/resources?q=sua`: 200, `application/json`, `Access-Control-Allow-Origin: *`, body `total: 1`, name `Sua`.
- `/api/health`: 200, `{"status":"ok","scope":"liveness","upstreamsChecked":false}`.
- `/api/contributors`: 200; the fixture KV has no contributors, so `error: "warming_up"` with an empty list is the expected local state.
- `/.well-known/api-catalog`: 200, `application/linkset+json`, a `linkset` array.
- Every `api-*.headers` file: `200` and `application/json`. Fixture bodies (check with `jq`):
  - `/api/awesome`: `.items | length` is 2, the first is `Sua`.
  - `/api/datasets`: `.datasets | length` is 2 (`wikimedia/wikipedia` first).
  - `/api/models`: `.models | length` is 2 (`FacebookAI/xlm-roberta-base` first).
  - `/api/repos`: `.repos | length` is 2.
  - `/api/events`: `.events | length` is 150 (recorded GDG feed).
  - `/api/pypi`: `{"version":"0.2.0","summary":"Odia language tools","releases":2}` (recorded PyPI).
  - `/api/search?q=sua`: `.results[0].title` is `Sua`, `href` `/r/gh/soumendrak/MTEnglish2Odia`.
  - `/api/translation-status`: `.total` is 46.
  - `/api/videos`: `.channels | length` is 2 (`OdiaGenAI` first).
  - `/api/`: 307 to `/api` (the HTML API index page; drive it with `node $S/drive.mjs /api`).
- `/mcp`: POST `tools/list` returns `result.tools` including `search`; `GET /mcp` is 405.

## Gotchas

- `/api/pypi` and `/api/events` depend on recorded upstream mocks in `test/e2e/serve.mjs`; under `E2E_UPSTREAM_FAILURE=1` they return the failure shape.
