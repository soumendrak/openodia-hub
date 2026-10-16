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
P="${VERIFY_PORT:-9171}"; E="${VERIFY_EVIDENCE:-${VERIFY_DIR:-/tmp/verify-openodia-hub}/evidence}"; B="http://127.0.0.1:$P"; bad=0
get() { local want="$1" name="$2" code; shift 2; code="$(curl -sS -m 15 -D "$E/$P-$name.headers" -o "$E/$P-$name.body" -w '%{http_code}' "$@")" || code=000; echo "$name $code (want $want)"; [ "$code" = "$want" ] || bad=1; }
get 200 api-resources "$B/api/resources?q=sua"
get 200 tools-md -H 'Accept: text/markdown' "$B/tools"
get 200 health "$B/api/health"
get 200 contributors "$B/api/contributors"
get 200 api-catalog "$B/.well-known/api-catalog"
for ep in awesome datasets events models pypi repos "search?q=sua" translation-status videos; do get 200 "api-$(echo "$ep" | tr -c 'a-z0-9\n' '_')" "$B/api/$ep"; done
get 307 api-index "$B/api/"
get 200 mcp-tools -X POST -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' "$B/mcp"
get 405 mcp-get "$B/mcp"
[ "$bad" = 0 ] && echo "API SWEEP OK" || { echo "API SWEEP FAIL"; false; }
```

Proof (each check prints its status and the sweep ends with `API SWEEP OK`, otherwise `API SWEEP FAIL` and a non-zero status; `<port>-<name>.headers` holds status, `Content-Type`, CORS and cache headers, and `<port>-<name>.body` holds the body (the port prefix keeps concurrent runs on different ports apart)):

- `/api/resources?q=sua`: 200, `application/json`, `Access-Control-Allow-Origin: *`, body `total: 1`, name `Sua`.
- `/api/health`: 200, `{"status":"ok","scope":"liveness","upstreamsChecked":false}`.
- `/api/contributors`: 200; the fixture KV has no contributors, so `error: "warming_up"` with an empty list is the expected local state.
- `/.well-known/api-catalog`: 200, `application/linkset+json`, a `linkset` array.
- Every `<port>-api-*.headers` file: `200` and `application/json`. Fixture bodies (check with `jq`):
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
