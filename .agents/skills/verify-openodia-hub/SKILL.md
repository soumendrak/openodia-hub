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

This skill runs on Linux only: step 3 needs `setsid` and `ss` (iproute2). Run `just doctor` and fix every `FAIL` line before going on. It checks Bun 1.3+, Node 22+, Playwright Chromium, the pinned zizmor and `ss`.

## 2. Standards

Run `git fetch origin`, bring the branch up to date with `origin/main`, then run `just check`. It is CI's gate, described under Commands in AGENTS.md, and must end with `STANDARDS OK`. Run it again after your last edit.

Fix the code or add tests when it fails. Never add `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `any`, a coverage skip or a code comment to get it green.

## 3. Start the fixture Worker

```bash
export VERIFY_PORT=9171
E="/tmp/verify-openodia-hub/$VERIFY_PORT"
start_worker() {
  command -v ss >/dev/null || { echo "start_worker needs ss (iproute2)"; return 1; }
  local listening
  listening="$(ss -ltnH "sport = :$VERIFY_PORT")" || { echo "ss failed; nothing started"; return 1; }
  if [ -n "$listening" ]; then
    echo "port $VERIFY_PORT is taken; nothing started, set another VERIFY_PORT"
    return 1
  fi
  mkdir -p "$E" && rm -f "$E/server.pid" && bun run build || return 1
  E2E_PORT=$VERIFY_PORT setsid -f sh -c 'echo $$ >"$1/server.pid"; exec node test/e2e/serve.mjs' sh "$E" >"$E/server.log" 2>&1 </dev/null
  local pgid="" listener="" tries=0
  while [ "$tries" -lt 120 ] && ! grep -q "Fixture Worker ready" "$E/server.log"; do
    pgid="$(cat "$E/server.pid" 2>/dev/null)"
    if [ -n "$pgid" ] && ! kill -0 "$pgid" 2>/dev/null; then break; fi
    sleep 1; tries=$((tries + 1))
  done
  pgid="$(cat "$E/server.pid" 2>/dev/null)"
  listener="$(ss -ltnpH "sport = :$VERIFY_PORT" | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)"
  if grep -q "Fixture Worker ready" "$E/server.log" && [ -n "$listener" ] && [ "$(ps -o pgid= -p "$listener" | tr -d ' ')" = "$pgid" ]; then
    echo "ready: process group $pgid owns port $VERIFY_PORT"
    return 0
  fi
  echo "fixture Worker did not start; log follows"
  cat "$E/server.log"
  [ -n "$pgid" ] && kill -- -"$pgid" 2>/dev/null
  rm -f "$E/server.pid"
  return 1
}
start_worker
```

`test/e2e/serve.mjs` runs the production build under Miniflare with local KV and D1, the seeded catalog in `test/e2e/fixtures/`, a clock fixed at 2026-10-12 and every upstream mocked, so no account or token is needed. Go on only after `ready:`. In a shell with `set -e`, a refusal from `start_worker` exits the shell; call it as `start_worker || echo "not started"` there. `start_worker` refuses a port that is already listening, without touching that server or its files. It returns 1 without touching any file when `ss` is missing or fails. It counts as started only when your own log has the ready line and the process listening on the port belongs to the process group in your `server.pid`; every fixture Worker reports the same date, so `/__fixture-clock` cannot tell them apart. Otherwise it prints the log, stops whatever it started and returns 1. `setsid` puts Node and its `workerd` child in one process group, whose id is `server.pid`, so step 6 stops both.

- Pick a free port. 9158, 9159, 9161 and 9162 belong to the browser suites (see Gotchas in AGENTS.md).
- For the outage variant, where nothing is seeded and every upstream fails, run `export E2E_UPSTREAM_FAILURE=1` before `start_worker` and `unset E2E_UPSTREAM_FAILURE` as soon as it prints `ready:`; the running server keeps its copy, and `just e2e` must not inherit the flag. The server log's ready line then ends in `(upstream outage)`.
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
