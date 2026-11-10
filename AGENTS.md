# Working in openodia-hub

Instructions for coding agents (Codex, Cursor, Claude Code and others) and for people. `CONTRIBUTING.md` covers the same ground in more depth; this file is the short version an agent needs before its first commit.

## Setup

Requires Bun 1.3+, Node.js 22+, [just](https://just.systems), Python 3 and Playwright Chromium.

```bash
bun install --frozen-lockfile
bunx playwright install --with-deps chromium
python3 -m venv "$HOME/.venvs/zizmor"
"$HOME/.venvs/zizmor/bin/pip" install --require-hashes -r scripts/standards/zizmor-requirements.txt
export PATH="$HOME/.venvs/zizmor/bin:$PATH"
```

`bun install` also points Git at the repository hooks in `.githooks/`. The standards gate requires exactly the zizmor version pinned in `scripts/standards/zizmor.ts` and runs it when any file under `.github/` or `scripts/standards`, or any `action.yml` or `action.yaml`, changes. That includes issue templates and `FUNDING.yml`. Keep the virtualenv outside the clone: the gate refuses untracked files.

## Commands

| Task                                  | Command                                   |
| ------------------------------------- | ----------------------------------------- |
| Dev server on `http://localhost:9090` | `bun run dev`                             |
| Production build                      | `bun run build`                           |
| Serve the built Worker                | `bun run preview` (after `build`)         |
| Lint (type-aware, about 20 s)         | `bun run lint`                            |
| Type check, normal and strict configs | `bun run typecheck`                       |
| Locale inventory                      | `bun run check:locales`                   |
| Unit tests                            | `bun run test`                            |
| One test file                         | `bun run test -- test/organizers.test.ts` |
| Bilingual browser check               | `bun run test:bilingual` (after `build`)  |
| Browser end-to-end suite              | `just e2e` (the same steps as CI's e2e)   |
| Check Bun, Node, Playwright, zizmor   | `just doctor`                             |
| Accessibility suite                   | `bun run test:a11y` (builds first)        |
| Every standard (CI's gate)            | `just check`                              |
| Standards on staged changes           | `bun scripts/standards.ts --staged`       |
| Update screenshot baselines           | `bun run test:e2e -- --update-snapshots`  |

`just check` compares against `git merge-base origin/main HEAD`. CI checks the pull request merged into the tip of `main`, against that tip, so a branch that is behind `main` can pass locally and fail in CI. Run `git fetch origin` and merge or rebase onto `origin/main` before trusting a local pass. The gate runs locales, lint, typecheck, the exceptions file, the no-new-comments check, zizmor and the tests with 100% changed-line coverage, and ends with `STANDARDS OK` or `STANDARDS FAIL`. The pre-commit hook runs the `--staged` form.

Before you open or update a pull request, prove the change with [`.agents/skills/verify-openodia-hub`](.agents/skills/verify-openodia-hub/SKILL.md). It runs `just check`, starts the fixture Worker and drives the changed pages, keeping screenshots and responses as evidence.

## Layout

- `src/routes/`: TanStack Start file routes, including `src/routes/api/` for the public API. `src/routeTree.gen.ts` is generated; do not edit it.
- `src/lib/sources/`: upstream loaders (GitHub, Hugging Face, YouTube, papers, events) shared by page loaders and API routes. `src/lib/sources/cache.ts` owns KV caching.
- `src/data/`: checked-in events, organizers and overrides. `src/locales/`: English and Odia strings.
- `src/events/`: the canonical event model. It and any future `src/boundary/` and `src/platform/` code are fenced: type-aware `strictTypeChecked` lint against `tsconfig.strict.json`, 100% coverage and no JavaScript files. Repository-wide, the `isolated/owned-types` rule guards `src/events` types and no file may import another module's `internal/` folder. Values of `src/events` types must be built by that module's constructors and parsers, never by casts, `any`, `JSON.parse` or a generic helper that launders one.
- `scripts/standards.ts` and `scripts/standards/`: the standards gate. `scripts/standards/exceptions.json` lists dated exceptions.
- `test/`: Vitest files. `test/e2e/`: Playwright specs, the Miniflare fixture server `serve.mjs`, seeded data in `fixtures/` and screenshot baselines in `visual/`.
- `db/`: D1 schema and migrations. `docs/`: architecture, event model, MCP and search notes.

## Rules

- Stage or stash every change before you commit, and never use `--no-verify` or any other way to skip the pre-commit hook. The hook and `just check` run `bun scripts/standards.ts`, the same standards CI runs, and it refuses untracked files and unstaged edits.
- A `no-new-comments` entry in `scripts/standards/exceptions.json` is only needed by the PR that adds the comment. Delete it in the next PR once the comment is on main: the standards flag it only after the comment text is gone, so a forgotten entry fails the exceptions step for everyone when it expires.
- Add no new comments in JS or TS files. Say it with names, types and tests instead.
- Every changed executable line needs test coverage. The gate requires 100% of changed lines, not 100% of the repository.
- Keep a PR under 400 changed lines, not counting tests, generated files and lockfiles. Split larger work into a sequence of PRs.
- `/` and `/playground` have separate Linux screenshot baselines (`test/e2e/visual/linux-*.png`) because CI runs on Linux. A visual change to either page updates both images, and Linux images come from a Linux machine or container.
- Do not run `just deploy` or `wrangler deploy`. Deployment runs from CI on `main`.

## Environment variables and secrets

Nothing is needed for the dev server, the unit tests or the browser suites; the e2e Worker uses local KV and D1 and answers every unseeded upstream with a 503.

| Name                                                      | Used by                                   | Without it                                                                                                                                                               |
| --------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GITHUB_TOKEN`                                            | `src/lib/sources/repos.ts`, `resource.ts` | GitHub calls are anonymous and share the 60 requests per hour limit, so the dev server's repository data can come back partial.                                          |
| `YOUTUBE_API_KEY`                                         | `src/lib/sources/videos.ts`               | Videos are listed from RSS without view counts.                                                                                                                          |
| `CLOUDFLARE_API_TOKEN`                                    | CI `deploy` and `preview` jobs            | No deployment or PR preview. Fork PRs skip the preview job.                                                                                                              |
| `CLOUDFLARE_ACCOUNT_ID`                                   | CI `preview` job, `sync-contributors.yml` | No PR preview, and the daily contributor sync to KV fails.                                                                                                               |
| `CLOUDFLARE_KV_API_TOKEN`, `CONTRIBUTORS_KV_NAMESPACE_ID` | `sync-contributors.yml`                   | The daily contributor sync to KV fails. The workflow passes the token to `scripts/sync-contributors.ts` as `CLOUDFLARE_API_TOKEN`; the script also needs `GITHUB_TOKEN`. |
| `PAT`                                                     | `crawl-events.yml`                        | The daily crawl cannot open its pull request.                                                                                                                            |
| `ODIA_NATIVE_REVIEWERS` (repository variable)             | `translation-review.yml`                  | PRs that change Odia wording get a failing `native-review` status.                                                                                                       |

`.env.example` lists the two runtime variables. Never commit a value.

## Gotchas

- The `/about` page load in `test/e2e/api-contracts.spec.ts` does not block external fonts and analytics. Offline or behind a firewall it can stall; rerun with outbound network.
- `test:e2e` and `test:a11y` rebuild `dist/` each time; `test:bilingual` uses the existing build.
- The browser suites bind ports 9158 (bilingual), 9159 (accessibility), 9161 and 9162 (end-to-end). Two worktrees running them at once collide; set `E2E_PORT` for `test:e2e` and `test:a11y`, or run them one after the other.
- The bilingual step that starts `just e2e` binds 9158: unless `BILINGUAL_BASE_URL` is set, `test/e2e/bilingual.mjs` starts the fixture server with `E2E_PORT=9158`, so your `E2E_PORT` does not move it. To run it beside another worktree, start `E2E_PORT=<port> node test/e2e/serve.mjs` yourself and set `BILINGUAL_BASE_URL=http://127.0.0.1:<port>`, or run `just e2e` in one worktree at a time.
- The fixtures pin the clock to 2026-10-12 and hold two or three sampled records per catalog. A page that reads a record the fixture lacks answers 404 under the e2e Worker.
- `just check` fails on an expired entry in `scripts/standards/exceptions.json` even when your change does not touch it.
