# Issue 61 — deterministic API and UX verification

## Scope

Completes the existing PR #124 smoke foundation against current main: per-route smoke specs, strict WCAG2 A/AA and WCAG2.1 AA scans in both themes, native built-Worker API contracts and upstream outages, keyboard/locale/dialog/editor checks, and six screenshot regressions. The minimal accessibility prerequisite is included verbatim from issue #59 so this is independently reviewable against main.

## Running the suite

Bun 1.3+, Node 22+ and Playwright Chromium are required. Run `bun install --frozen-lockfile`, `bunx playwright install chromium`, then `bun run test:e2e`. This builds the production Cloudflare Worker and runs it in Miniflare. CI runs the same built artifact in a dedicated `e2e` job, and deployment/preview depend on it. `bun run preview` remains the real Wrangler preview command for interactive use; the tests use Miniflare to enforce outbound-network isolation.

The Worker has local ephemeral KV/D1 bindings. Recorded catalog values exercise production cache paths. Synthetic Bevy HTML and PyPI JSON exercise production adapters. All other external Worker requests receive explicit 503 fixture responses; browser fonts, analytics, images and external runtimes are aborted. No Cloudflare credentials or live upstream availability are required. A second cold Worker demonstrates upstream failure handling rather than a cached success.

Fixtures are sampled records (trimmed to 2–3 items), not a completeness statement about today's catalogs. Screenshots use fixed 2026-10-12 browser time, pinned OFL production font families, reduced motion and a 1.5% pixel tolerance. They are checked in and must be reviewed when deliberately updated. Pinned test-only fonts remove the large Mac/Linux fallback-font difference; CI still needs to be observed after publication.

## Assertions

- Every page route, including communities and a model-detail permalink, verifies HTTP status, unique correct h1, title, fixture cards and no uncaught browser errors. Unknown routes and invalid resource paths expect 404.
- Each route runs strict axe scans in light and dark without disabled rules.
- Native JSON endpoints validate status, content type, CORS, collection shape and expected item fields. Search input errors and model search, resource pagination, PyPI version/release mapping, API discovery, sitemap, llms files, event feed and MCP tool discovery are checked.
- Cold-model/dataset/repository requests return 503 plus errors.
- Eight width/theme cases (320/390/768/1440px, light/dark) verify skip focus, locale inheritance, overflow, named command dialog, Tab containment, Escape and focus restoration. Editor Escape/Tab and computed reduced-motion styles are verified.
- Screenshots cover `/`, `/tools`, `/models`, `/datasets`, `/events`, `/playground`.
- CI posts/updates a sticky coverage report for trusted same-repository PRs only. It shows repository metrics separately from the 100% changed-executable-line gate. Fork tests run with no comment-write attempt.

## Limits

Recorded browser/API checks are deterministic regression evidence, not an assertion that public upstream services are healthy. Native screen-reader speech has not been audited. The whole-repository branch baseline and changed-line gate are reported separately; no additional coverage exclusions are introduced.

## Verified results

The final suite passed **61/61 Chromium checks** without updating snapshots. A separate native API run passed **12/12** including MCP tool discovery, and real local Odialang execution plus search-filter restoration passed **2/2**. Both-theme route axe scans report no WCAG A/AA violations. Lint reports no errors (18 pre-existing warnings); TypeScript and the production build pass.

The shared accessibility prerequisite's full Vitest coverage gate passed 797 tests and 58/58 changed executable lines. At that point repository statements/functions/lines were 100%, with 13 existing branch gaps (99.57%), tracked separately for the shared baseline completion.

An actual T3 browser session at 320px verified first Tab skip visibility and a 3px focus ring, Enter focus transfer, mobile menu reachability, language attributes, command dialog focus/close and theme toggling without overflow. No new uncaught exceptions were recorded for that session. Native screen-reader speech and remote CI results remain distinct from this local evidence.
