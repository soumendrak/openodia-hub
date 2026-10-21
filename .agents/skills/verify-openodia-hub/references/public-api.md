# Public API sweep

The JSON and Markdown endpoints the Worker serves, checked against the fixture Worker from step 3 of the skill. Each request saves `<name>.headers` and `<name>.body` under `$A`. By default that is the same folder as step 3's `$E`; it is a separate variable so that setting `VERIFY_EVIDENCE` moves only the sweep's files. Every `/api/*` response and the API catalog must carry exactly `Access-Control-Allow-Origin: *`; the header checks strip curl's trailing carriage return and anchor the value, so `**` or `application/jsonp` fails. `/llms.txt` and `/llms-full.txt` are checked for `text/plain` and their opening lines, `/events-feed` for RSS with the recorded event, and `/sitemap.xml` for XML that lists `/tools`. The sweep ends with `API SWEEP OK`, or with `API SWEEP FAIL` and a non-zero status.

```bash
P="${VERIFY_PORT:-9171}"; A="${VERIFY_EVIDENCE:-/tmp/verify-openodia-hub/$P}"; B="http://127.0.0.1:$P"; bad=0; mkdir -p "$A"
get() { local want="$1" name="$2" code; shift 2; code="$(curl -sS -m 15 -D "$A/$name.headers" -o "$A/$name.body" -w '%{http_code}' "$@")" || code=000; echo "$name $code (want $want)"; [ "$code" = "$want" ] || bad=1; }
has() { jq -e "$2" "$A/$1.body" >/dev/null 2>&1 && echo "$1 body ok" || { echo "$1 body FAIL: $2"; bad=1; }; }
hdr() { tr -d '\r' <"$A/$1.headers" | grep -qiE "$2" && echo "$1 header ok" || { echo "$1 header FAIL: $2"; bad=1; }; }
get 200 api-resources "$B/api/resources?q=sua"
get 200 tools-md -H 'Accept: text/markdown' "$B/tools"
get 200 api-health "$B/api/health"
get 200 api-contributors "$B/api/contributors"
get 200 api-catalog "$B/.well-known/api-catalog"
get 200 api-openapi "$B/.well-known/openapi.json"
get 200 llms "$B/llms.txt"
get 200 llms-full "$B/llms-full.txt"
get 200 events-feed "$B/events-feed"
get 200 sitemap "$B/sitemap.xml"
for ep in awesome datasets events models pypi repos "search?q=sua" translation-status videos; do get 200 "api-$(echo "$ep" | tr -c 'a-z0-9\n' '_')" "$B/api/$ep"; done
get 307 api-index "$B/api/"
get 200 mcp-tools -X POST -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' "$B/mcp"
get 405 mcp-get "$B/mcp"
get 200 mcp-search -X POST -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search","arguments":{"query":"sua"}}}' "$B/mcp"
hdr api-index '^location: */api$'
hdr api-catalog '^content-type: *application/linkset\+json(;.*)?$'
for f in "$A"/api-*.headers; do
  n="$(basename "$f" .headers)"; [ "$n" = api-index ] && continue
  hdr "$n" '^access-control-allow-origin: *\*$'
  [ "$n" = api-catalog ] || hdr "$n" '^content-type: *application/json(;.*)?$'
done
hdr tools-md '^content-type: *text/markdown(;.*)?$'
for n in llms llms-full; do hdr "$n" '^content-type: *text/plain(;.*)?$'; done
hdr events-feed '^content-type: *application/rss\+xml(;.*)?$'
hdr sitemap '^content-type: *application/xml(;.*)?$'
grep -q '<title>Odia AI Community Events</title>' "$A/events-feed.body" && grep -q 'Recorded Odia AI workshop' "$A/events-feed.body" && echo "events-feed body ok" || { echo "events-feed body FAIL"; bad=1; }
grep -q '<loc>https://openodia.com/tools</loc>' "$A/sitemap.body" && echo "sitemap body ok" || { echo "sitemap body FAIL"; bad=1; }
grep -q '^# Tools · OpenOdia' "$A/tools-md.body" && ! grep -qi '<html' "$A/tools-md.body" && echo "tools-md body ok" || { echo "tools-md body FAIL"; bad=1; }
[ "$(head -1 "$A/llms.body")" = "# OpenOdia" ] && grep -q '^## APIs' "$A/llms.body" && echo "llms body ok" || { echo "llms body FAIL"; bad=1; }
[ "$(head -1 "$A/llms-full.body")" = "# OpenOdia — Open source for the Odia language" ] && grep -q '^Source code: ' "$A/llms-full.body" && echo "llms-full body ok" || { echo "llms-full body FAIL"; bad=1; }
has api-resources '.total == 1 and .resources[0].name == "Sua"'
has api-health '.status == "ok" and .scope == "liveness" and .upstreamsChecked == false'
has api-contributors '.error == "warming_up" and .contributors == []'
has api-catalog '.linkset | type == "array"'
has api-openapi '(.openapi | startswith("3.")) and (.paths | length) > 0'
has api-awesome '(.items | length) == 2 and .items[0].name == "Sua"'
has api-datasets '(.datasets | length) == 2'
has api-models '(.models | length) == 2'
has api-repos '(.repos | length) == 2'
has api-events 'any(.events[]; .title == "Recorded Odia AI workshop") and (.sources | length) > 0 and ([.sources[].outcome] | all(. == "success-events"))'
has api-pypi '.version == "0.2.0" and .releases == 2'
has api-search_q_sua '.results[0].title == "Sua" and .results[0].href == "/r/gh/soumendrak/MTEnglish2Odia"'
has api-translation_status '.total > 0'
has api-videos '(.channels | length) == 2'
has mcp-tools '[.result.tools[].name] | index("search") != null'
has mcp-search '.result.isError != true and .result.structuredContent.results[0].title == "Sua"'
[ "$bad" = 0 ] && echo "API SWEEP OK" || { echo "API SWEEP FAIL"; false; }
```

What the fixtures return:

- `/api/contributors` answers `error: "warming_up"` with an empty list, because the fixture KV holds no contributors.
- `/api/pypi` and `/api/events` come from the recorded PyPI and GDG responses in `test/e2e/serve.mjs`. With `E2E_UPSTREAM_FAILURE=1` they return the failure shape instead.
- `/api/` redirects to `/api`, the HTML index page, and the sweep checks the `Location` header; check that page with `drive /api`.
- `/mcp` takes JSON-RPC over POST, and `GET /mcp` answers 405. The sweep lists the tools and calls `search` for `sua`, which must return Sua first in `structuredContent`.
