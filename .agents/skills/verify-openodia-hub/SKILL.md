---
name: verify-openodia-hub
description: >
  Proves that a change to OpenOdia Hub works before review. Runs the repository's
  standards gate, starts the built Worker with recorded fixtures, drives the changed
  pages in headless Chromium and over HTTP, and keeps screenshots and responses as
  evidence. Use after changing src/, scripts/, the Worker or its tests, and before
  opening or updating a pull request.
---

# Verify OpenOdia Hub

The commands come from [AGENTS.md](../../../AGENTS.md). This skill puts them in order and adds the journeys that show a change working. Run everything from the repository root.

## 1. Toolchain

Run `just doctor` and fix every `FAIL` line before going on. It checks Bun 1.3+, Node 22+, Playwright Chromium and the pinned zizmor.

## 2. Standards

Run `git fetch origin`, bring the branch up to date with `origin/main`, then run `just check`. It is CI's gate, described under Commands in AGENTS.md, and must end with `STANDARDS OK`. Run it again after your last edit.

Fix the code or add tests when it fails. Never add `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `any`, a coverage skip or a code comment to get it green.

## 3. Start the fixture Worker

```bash
export VERIFY_PORT=9171
E="/tmp/verify-openodia-hub/$VERIFY_PORT"; mkdir -p "$E"
bun run build
E2E_PORT=$VERIFY_PORT setsid -f sh -c 'echo $$ >"$1/server.pid"; exec node test/e2e/serve.mjs' sh "$E" >"$E/server.log" 2>&1 </dev/null
timeout 120 sh -c "until grep -q 'Fixture Worker ready' '$E/server.log'; do sleep 1; done"
curl -sS "http://127.0.0.1:$VERIFY_PORT/__fixture-clock"
```

`test/e2e/serve.mjs` runs the production build under Miniflare with local KV and D1, the seeded catalog in `test/e2e/fixtures/`, a clock fixed at 2026-10-12 and every upstream mocked, so no account or token is needed. The clock answer must show `2026-10-12`; anything else means another server owns the port. `setsid` starts the server in its own process group, whose id it writes to `server.pid`, so step 6 stops Node and its `workerd` child together.

- Pick a free port. 9158, 9159, 9161 and 9162 belong to the browser suites (see Gotchas in AGENTS.md).
- For the outage variant, where nothing is seeded and every upstream fails, run `export E2E_UPSTREAM_FAILURE=1` before these commands and `unset E2E_UPSTREAM_FAILURE` after step 6. The server log's ready line then ends in `(upstream outage)`.
- The Worker serves this worktree's `dist/`. To test a new edit, stop it, rebuild and start it again.
- `bun run dev` talks to live upstreams, so it is not proof.

## 4. Drive the change

- Browser: `node .agents/skills/verify-openodia-hub/scripts/drive.mjs <path> [step ...]`, described in [references/drive.md](references/drive.md).
- HTTP: `curl` with `-D` for headers, saved under `$E`.
- [references/features.md](references/features.md) maps each page and feature to its journeys, and [references/public-api.md](references/public-api.md) holds the API sweep. Run every journey listed for the area you touched, not only the easiest one.

When the change touches layout, translations or shared components, also run `just e2e`. Never update the screenshot baselines in `test/e2e/visual/` just to make it pass.

## 5. Evidence

Screenshots, saved responses, `<run>-drive.json` files and curl output stay in `$E`.

- Drive the real UI or a public HTTP route. No internal setters or test-only endpoints; `/__fixture-clock` is only for the check in step 3.
- Capture the action and its result: the screenshot before, the step, the screenshot after and the response behind it.
- Check side effects as well as the screen: status, body, headers (cache, CORS, content type), and the D1 rows or KV keys the change writes.
- Mock only at the existing boundary. `serve.mjs` mocks upstream HTTP; nothing inside `src/` gets mocked.
- If the fixtures lack the data a journey needs, report the journey as failed and why. Do not weaken it.

In the pull request description, list the commands you ran, the `STANDARDS OK` line, each drive summary and the key screenshots.

## 6. Stop

```bash
kill -- -"$(cat "$E/server.pid")"
```

This stops only the process group you started. Never `pkill node` or `pkill workerd`: other agents share the machine. The evidence stays in `$E`.

## Keeping this skill current

When a route, placeholder, button name, fixture or public endpoint changes, update its entry in `references/` and run that journey again.
