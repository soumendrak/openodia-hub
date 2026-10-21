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

This skill runs on Linux only: step 3 needs `setsid` and `ss` (iproute2). Run `just doctor` and fix every `FAIL` line before going on. It checks Bun 1.3+, Node 22+, Playwright Chromium, the pinned zizmor, `setsid`, `ss`, and the `curl` and `jq` that the API sweep uses.

## 2. Standards

Run `git fetch origin`, bring the branch up to date with `origin/main`, then run `just check`. It is CI's gate, described under Commands in AGENTS.md, and must end with `STANDARDS OK`. Run it again after your last edit.

Fix the code or add tests when it fails. Never add `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `any`, a coverage skip or a code comment to get it green.

## 3. Start the fixture Worker

```bash
export VERIFY_PORT=9171
start_worker() {
  local d="/tmp/verify-openodia-hub/$VERIFY_PORT" listening pgid="" listener="" tries=0
  command -v ss >/dev/null || { echo "start_worker needs ss (iproute2)"; return 1; }
  listening="$(ss -ltnH "sport = :$VERIFY_PORT")" || { echo "ss failed; nothing started"; return 1; }
  if [ -n "$listening" ]; then
    echo "port $VERIFY_PORT is taken; nothing started, set another VERIFY_PORT"
    return 1
  fi
  mkdir -p "$d" && rm -f "$d/server.pid" && bun run build || return 1
  E2E_PORT=$VERIFY_PORT setsid -f sh -c 'echo $$ >"$1/server.pid"; exec node test/e2e/serve.mjs' sh "$d" >"$d/server.log" 2>&1 </dev/null
  while [ "$tries" -lt 120 ] && ! grep -q "Fixture Worker ready" "$d/server.log"; do
    pgid="$(cat "$d/server.pid" 2>/dev/null)"
    if [ -n "$pgid" ] && ! kill -0 "$pgid" 2>/dev/null; then break; fi
    sleep 1; tries=$((tries + 1))
  done
  pgid="$(cat "$d/server.pid" 2>/dev/null)"
  listener="$(ss -ltnpH "sport = :$VERIFY_PORT" | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)"
  if grep -q "Fixture Worker ready" "$d/server.log" && [ -n "$listener" ] && [ "$(ps -o pgid= -p "$listener" | tr -d ' ')" = "$pgid" ]; then
    E="$d" WORKER_PGID="$pgid"
    echo "ready: process group $pgid owns port $VERIFY_PORT"
    return 0
  fi
  echo "fixture Worker did not start; log follows"
  cat "$d/server.log"
  [ -n "$pgid" ] && kill -- -"$pgid" 2>/dev/null
  rm -f "$d/server.pid"
  return 1
}
start_worker
```

`test/e2e/serve.mjs` runs the production build under Miniflare with local KV and D1, the seeded catalog in `test/e2e/fixtures/`, a clock fixed at 2026-10-12 and every upstream mocked, so no account or token is needed. Go on only after `ready:`. Only a successful start sets `$E` (this run's folder) and `$WORKER_PGID` (the process group it started); a refusal or failure leaves both as they were, so after a refusal you can export another port and call it again. Run one Worker per shell: a second start replaces `$WORKER_PGID`. In a script with `set -e`, call it as `start_worker || exit 1`, then run `trap "kill -- -$WORKER_PGID 2>/dev/null" EXIT` so a failed journey still stops the Worker. The double quotes put the group number into the trap when you set it, so the trap never reads a path or a variable at exit, and it it replaces any `EXIT` trap the script already set; if you have one, add the `kill` to it instead. `start_worker` refuses a port that is already listening, without touching that server or its files. It returns 1 without touching any file when `ss` is missing or fails. It counts as started only when your own log has the ready line and the process listening on the port belongs to the process group in your `server.pid`; every fixture Worker reports the same date, so `/__fixture-clock` cannot tell them apart. Otherwise it prints the log, stops whatever it started and returns 1. `setsid` puts Node and its `workerd` child in one process group, whose id is `server.pid`, so step 6 stops both.

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
[ -n "${WORKER_PGID:-}" ] && kill -- -"$WORKER_PGID"; unset WORKER_PGID
```

This stops only the process group that `start_worker` recorded when it started, never one read back from a folder, and does nothing on a second run. If you set the step 3 trap, run `trap - EXIT` afterwards. Never `pkill node` or `pkill workerd`: other agents share the machine. The evidence stays in `$E`.

## Keeping this skill current

When a route, placeholder, button name, fixture or public endpoint changes, update its entry in `references/` and run that journey again.
