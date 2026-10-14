# Issue 61 — deterministic API and UX verification

## Scope

Completes the existing PR #124 smoke foundation against current main: per-route smoke specs, strict WCAG2 A/AA and WCAG2.1 A/AA scans in both themes, native built-Worker API contracts and upstream outages, keyboard/locale/dialog/editor checks, and six screenshot regressions. The initial accessibility prerequisite came from issue #59 so this is independently reviewable against main; the editor parity follow-up below preserves its later physical-key fix.

## Running the suite

Bun 1.3+, Node 22+ and Playwright Chromium are required. Run `bun install --frozen-lockfile`, `bunx playwright install chromium`, then `bun run test:e2e`. This builds the production Cloudflare Worker and runs it in Miniflare. CI runs the same built artifact in a dedicated `e2e` job, and deployment/preview depend on it. `bun run preview` remains the real Wrangler preview command for interactive use; the tests use Miniflare to enforce outbound-network isolation.

The Worker has local ephemeral KV/D1 bindings. Recorded catalog values exercise production cache paths. Synthetic Bevy HTML and PyPI JSON exercise production adapters. All other external Worker requests receive explicit 503 fixture responses; browser fonts, analytics, images and external runtimes are aborted. No Cloudflare credentials or live upstream availability are required. A second cold Worker demonstrates upstream failure handling rather than a cached success.

Fixtures are sampled records (trimmed to 2–3 items), not a completeness statement about today's catalogs. Screenshots and event rendering use the same fixed 2026-10-12 Worker/browser JavaScript time, pinned OFL production font families, reduced motion and a 1.5% pixel tolerance. They are checked in and must be reviewed when deliberately updated. Pinned test-only fonts remove the large Mac/Linux fallback-font difference; The executable-head Linux CI run passed all checks and its preview.

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

The previous executable head `ca97e4c` passed **66/66 Chromium checks**, including **13/13 native API/clock checks**, MCP tool discovery, real local Odialang execution, search-filter restoration and all six visual regressions at the unchanged 1.5% tolerance. Both-theme route axe scans report no WCAG 2/2.1 A/AA violations. Lint reports no errors (18 pre-existing warnings); TypeScript and the production build pass. GitHub CI and preview passed for this executable head.

That previous full Vitest gate passed **809 tests across 79 files**, with **100% statements (4785/4785), branches (3091/3091), functions (1239/1239), and lines (4293/4293)**. Whole-PR changed executable lines passed **98/98**. The shared baseline fallback/tie tests close the previous branch gaps; no coverage exclusions were added.

An actual T3 browser session at 320px verified first Tab skip visibility and a 3px focus ring, Enter focus transfer, mobile menu reachability, language attributes, command dialog focus/close and theme toggling without overflow. No new uncaught exceptions were recorded for that session. Native screen-reader speech and remote CI results remain distinct from this local evidence.

Linux Chromium uses separately reviewed home/playground baselines because the pinned fonts still rasterize differently across operating systems. The other four key-page baselines pass on both platforms. Linux images were inspected from the CI artifact; the 1.5% regression tolerance is unchanged.

## Bot-review follow-up

Editor Escape navigation is consumed by one Tab and cleared on blur; keyboard re-entry restores indentation. The marquee control is hidden while reduced motion makes scrolling static. Locale-control names reference separate language-tagged elements, and remaining static Odia fragments/input examples carry `lang=or`; the glyph has an English accessible description. Browser checks exercise these behaviors and compare the Worker and browser clocks, both fixed at 2026-10-12 before production code evaluates.

Smoke checks also reject recoverable React hydration errors. CI cancels superseded runs and checks the current PR head before creating/updating the sticky coverage report; tests exercise head changes before and during comment lookup.

## Independent editor parity — 2026-10-13

The exact issue-59 editor fix is backported so this independent preview also supports physical Escape → Shift+Tab navigation. Modifier-only Shift/Control/Alt/Meta/AltGraph keydowns preserve the one-shot latch; ordinary typing cancels it, and consumed Tab or blur clears it. Two regression cases fail against the old editor; all four focused accessibility unit tests pass after the fix. The existing built-Worker marquee/editor case now emits real Shift+Tab and checks focus exit, unchanged code, and indentation after reentry. No wording, baseline or visual tolerance changes.

Fresh production build and TypeScript checks pass; lint has no errors and the same 18 existing warnings. All **66/66 Chromium checks** pass, including the physical Shift regression and all **six visual regressions at the unchanged 1.5% tolerance**. The normal hook on tested source `dd8889bfed193acfc6f0244da0e3c403ed91a6d6` passed **810 tests across 79 files**, with **100% statements (4785/4785), branches (3093/3093), functions (1239/1239), and lines (4294/4294)**. The staged executable diff passes **3/3**; the whole `origin/main...HEAD` executable diff passes **100/100**, with zero uncovered lines or missing report files. The reused fresh hook report, logs, and portable embedded browser report are retained under `.lavish/pr124-shift-followup/`. This subsequent documentation annotation does not change the tested source, tests, baselines, thresholds, or hook configuration.
