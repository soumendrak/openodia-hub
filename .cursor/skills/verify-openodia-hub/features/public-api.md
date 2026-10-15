# Public API

JSON and markdown endpoints served by the Worker.

## Sub-features

- `/api/` index, `/api/resources`, `/api/search`, `/api/events`, `/api/models`, `/api/datasets`, `/api/repos`, `/api/videos`, `/api/awesome`, `/api/pypi`, `/api/translation-status`
- Markdown negotiation with `Accept: text/markdown`

## How to get to it (user POV)

`/api` page in the footer, or direct HTTP.

## Driving it with curl

```bash
curl -sS -D - "http://127.0.0.1:9171/api/resources?q=sua" -o "$VERIFY_EVIDENCE/api-resources.json"
curl -sS -D - -H 'Accept: text/markdown' http://127.0.0.1:9171/tools -o "$VERIFY_EVIDENCE/tools.md"
```

Proof: status 200, `Content-Type: application/json`, `Access-Control-Allow-Origin: *`, body `total: 1`, name `Sua`.

## Gotchas

- `/api/pypi` and `/api/events` depend on recorded upstream mocks in `test/e2e/serve.mjs`; under `E2E_UPSTREAM_FAILURE=1` they return the failure shape.
