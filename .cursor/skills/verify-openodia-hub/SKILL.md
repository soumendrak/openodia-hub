---
name: verify-openodia-hub
description: Prove a change to OpenOdia Hub (TanStack Start app on a Cloudflare Worker) works before code review. Builds the production Worker, runs it locally under Miniflare with recorded fixtures, drives the changed page in headless Chromium and over HTTP, captures screenshots and response bodies, and enforces Soumen's gates (strict TS, ESLint, 100% changed-line coverage, no new code comments). Use after any change to src/, scripts/ or the Worker, and before opening or updating a PR.
---

# Verify OpenOdia Hub

All commands run from the repo root. Helpers live in `.cursor/skills/verify-openodia-hub/scripts/` (call it `$S`).
Requirements already on the dev box: `bun`, `node` 20+, Playwright Chromium (`bunx playwright install chromium` if missing).
No Cloudflare login, token or secret is needed: the harness never touches remote KV/D1 or the network.

## 1. Standards gate (run first, run last)

```bash
S=.cursor/skills/verify-openodia-hub/scripts
$S/standards.sh origin/main
```

Runs, in CI order: `bun run check:locales`, `bun run lint`, `bunx tsc --noEmit -p tsconfig.json` (tsconfig has `strict: true`),
`bun run test:coverage:diff -- --base origin/main` (vitest + 100% coverage of every changed executable line, same gate as CI `test` job),
a check that no untracked source files exist (diff gates cannot see them; `git add -N <file>` fixes it), and a scan of added lines for new `//`, `/* */` or JSX comments. Ends with `STANDARDS OK` or `STANDARDS FAIL`.
Rules: never add `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `any`, or `/* v8 ignore */` to pass; never add code comments; fix the code or add tests.
Existing comments on main are not yours to remove in an unrelated change.

## 2. Launch

```bash
$S/launch.sh
```

Runs `bun install --frozen-lockfile`, `bun run build`, then `node test/e2e/serve.mjs` (the repo's own e2e harness) on `VERIFY_PORT` (default 9171).
That is the built production Worker under Miniflare with fresh in-memory KV and D1, `db/schema.sql` applied, `test/e2e/fixtures/catalog-kv.jsonl` seeded, the clock frozen at 2026-10-12T00:00:00Z, and all outbound network mocked (PyPI and GDG recorded, everything else 503).
Ready = log line `Fixture Worker ready` AND `GET /api/videos` returns 200; the script prints `ready http://127.0.0.1:<port> pid=<pid>`.
`VERIFY_SKIP_BUILD=1` reuses an existing `dist/` (only when nothing changed since the last build).
Set `E2E_UPSTREAM_FAILURE=1` before launch to get the outage variant (no seed, every upstream fails) for error-state changes; readiness then probes `/__fixture-clock` because `/api/videos` intentionally returns 503, launch records the mode in `$VERIFY_DIR/server-<port>.mode`, and doctor expects that 503 instead of 200.
Isolation: under a repo lock, launch builds and then copies `dist/`, `db/` and `test/e2e/` into an immutable snapshot `$VERIFY_DIR/app-<port>` (with `node_modules` symlinked), and runs `serve.mjs` from there. Each port gets its own snapshot, pid file and log, and its generated entry files live inside its snapshot, so a later build or another launch never swaps a running server's assets. Pick a different `VERIFY_PORT` to run a second instance. Avoid 9158 and 9161/9162, used by `bun run test:bilingual` and `bunx playwright test`.
`bun run dev` (vite, port 9090) is for humans: it hits live upstreams and remote bindings, so do not use it as proof.

## 3. Doctor

```bash
$S/doctor.sh
```

Read-only. Checks the recorded pid is ours (the same start-time, repo-root, `serve.mjs` command-line and `E2E_PORT` checks as cleanup, via `scripts/owned.sh`), shows the port listener (a `workerd` child, so its pid differs from ours), confirms `/__fixture-clock` reports 2026-10-12 (proves it is our fixture Worker, not someone's dev server), `/api/videos` is 200, and the snapshot's `dist/` is newer than HEAD and than every working-tree input (`src/`, `public/`, lockfile, configs). `DOCTOR FAIL` means relaunch, never drive.

## 4. Drive

Browser, real user path:

```bash
node $S/drive.mjs <path> [step ...]
```

A same-origin fetch/XHR response >= 400 fails the journey (`httperror` in the log, `ok: false`, exit 1). A journey that deliberately exercises an error state lists the expected statuses in `VERIFY_ALLOW_STATUS`, for example `VERIFY_ALLOW_STATUS=503` with `E2E_UPSTREAM_FAILURE=1`.

Steps: `fill:<placeholder>=<value>`, `click:<button accessible name, substring match>`, `link:<link name, substring match>`, `press:<key>`, `expect:<visible text>`, `goto:<path>`.
It blocks every non-local request, freezes the page clock, screenshots after load and after every step as `<run>-NN-<step>.png`, logs every same-origin response, page error and hydration/React console error or warning (the same filter as `test/e2e/bilingual.mjs`), saves every same-origin fetch/XHR response (including `/_serverFn/*`) as `<run>-api-NN-<path>.json` (method, status, headers, request body) plus `.body`, writes `<run>-drive.json` (`<run>` is a ms timestamp, so runs never overwrite each other), records every navigation status in `navigations`, and exits 1 on any page error, hydration error, failed step or 4xx/5xx navigation. A failing step still writes the JSON (with `failed`) and a `failed` screenshot. Values may contain `=` and `:`; only the first separator splits. Check intended error pages with curl instead.
Example that was run on main:

```bash
node $S/drive.mjs /tools "fill:Search projects, repos, datasets, models… [/]=fixture-no-match-93817" "expect:No projects match" "fill:Search projects, repos, datasets, models… [/]=" "expect:Sua"
```

For interactions the step language cannot express (dialogs, checkboxes, keyboard focus), write a throwaway Playwright script in `$VERIFY_DIR` modelled on `test/e2e/*.spec.ts` and run it against the same port; reuse their selectors (ARIA roles and names), not CSS classes or coordinates.

HTTP, for API and SSR changes:

```bash
P="${VERIFY_PORT:-9171}"; E="${VERIFY_EVIDENCE:-${VERIFY_DIR:-/tmp/verify-openodia-hub}/evidence}"
curl -sS -D "$E/api-resources.headers" "http://127.0.0.1:$P/api/resources?q=sua" -o "$E/api-resources.json"
```

Routes: `/api/`, `/api/health`, `/api/contributors`, `/.well-known/api-catalog`, `/mcp` (POST JSON-RPC), `/api/awesome`, `/api/datasets`, `/api/events`, `/api/models`, `/api/pypi`, `/api/repos`, `/api/resources`, `/api/search`, `/api/translation-status`, `/api/videos`, plus markdown negotiation (`-H 'Accept: text/markdown'`) and `/r/<kind>/<owner>/<name>` detail pages.
Feature recipes: `features/README.md`. Run every journey the map lists for the area you touched, not only the easiest one.

Regression suites (same server stack, own ports): `bun run test:bilingual` and `bunx playwright test` (needs a prior `bun run build`). Run them when the change touches layout, i18n or shared components. Visual snapshots in `test/e2e/visual/` must not be updated just to get green.

## 5. Evidence

Everything goes to `VERIFY_EVIDENCE` (default `/tmp/verify-openodia-hub/evidence`): screenshots `<run>-NN-<step>.png`, `<run>-drive.json`, curl headers and bodies, and `standards.log` (`$S/standards.sh origin/main > "${VERIFY_EVIDENCE:-${VERIFY_DIR:-/tmp/verify-openodia-hub}/evidence}/standards.log" 2>&1`).
Proof standards:

- Drive the real UI or public HTTP route. No internal setters, no test-only endpoints (`/__fixture-clock` is for the doctor only).
- Capture the action and the resulting state: a before screenshot, the step, the after screenshot, plus the response that caused it.
- Check side effects alongside the screen: response status and body, headers (cache, CORS, content-type), D1 rows or KV keys when the change writes them.
- Mocks only at the existing boundary: upstream HTTP is mocked by `serve.mjs`; do not mock anything inside `src/`.
- If the fixture seed lacks data a journey needs, report the journey as failed and why. Do not weaken the journey.
  In the PR description list: commands run, `STANDARDS OK` output, the drive JSON summary, and the key screenshots.

## 6. Cleanup

```bash
$S/cleanup.sh
```

Kills only the pid recorded in `$VERIFY_DIR/server-<port>.pid`, and only after checking that its start time, repo root, `test/e2e/serve.mjs` command line and `E2E_PORT` still match, so a stale or foreign pid is never signalled. It removes that port's snapshot `$VERIFY_DIR/app-<port>` (which holds the generated entry and clock files) and keeps the evidence directory. Never `pkill node` or `pkill workerd`; other agents share this box. Run cleanup after failed attempts too.

## Maintenance

Keep this skill honest by hand whenever the app changes:

1. A route, placeholder, button name or fixture changed: update the matching `features/*.md` recipe and rerun its drive command.
2. A new user-facing page or public endpoint: add a feature file (or a line in `features/public-api.md`) and list it in `features/README.md`.
3. `package.json` scripts, `test/e2e/serve.mjs` or CI gates changed: update `scripts/launch.sh` / `scripts/standards.sh` and sections 1-2 here.
4. Prove the edit: launch, doctor, drive one changed journey, cleanup, and confirm the evidence remains.
