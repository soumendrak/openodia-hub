# Issue 59 — accessibility verification

## Behavior fixed

- Communities heading fits 320px without horizontal overflow.
- Skip-to-content is the first Tab stop and moves keyboard focus to the main landmark.
- Every route has a visible two-tone focus ring, including controls that set `outline-none`. Buttons have a minimum 24px target, including small directory clear controls.
- English main/footer and command-dialog content retain `lang=en` when the document/navigation switch to Odia. Existing document locale updates and persistence are preserved.
- Code editor has a useful accessible name and Escape followed by Tab or Shift+Tab releases its indentation shortcut, allowing keyboard users to leave it.
- Event search, clear button and both select filters have accessible names. Filter and pagination counts announce updates through polite, atomic status regions.
- Reduced motion cancels CSS animation and smooth scrolling, removes card hover travel and disables magnetic pointer movement. Normal-motion users can pause/resume marquee scrolling; repeated marquee content is hidden from assistive technology.
- Facet counts, event badges, editor line numbers, inline links, and both themes' error text are readable without removing any axe rules.

## Reproducible checks

Use Bun 1.3+ and Node 22+. `bun run test:a11y` builds the production Worker and runs the standalone accessibility suite with real Chromium, recorded catalog fixtures and upstream networking disabled. No Cloudflare credentials or production bindings are used.

Browser checks cover 320/390/768/1440px in both themes: first Tab/Enter skip behavior, visible skip link, language inheritance, no horizontal overflow, command-dialog accessible name, Tab containment, Escape dismissal and focus restoration. Editor Escape/Tab and actual computed reduced-motion styles are checked in the browser. Axe scans use WCAG 2 A/AA and WCAG 2.1 A/AA; no exclusions or disabled rules.

Unit tests exercise editor keyboard escape, reduced-motion pointer/scroll handling, and marquee pause/resume/repeated-copy semantics. Existing full Vitest suite, lint, TypeScript and build are required before publication.

## Evidence and limits

The initial built-Worker audit found real contrast and unnamed-control failures across eight routes. The fixes address those findings, including an additional dark-theme error-state contrast failure discovered by the expanded suite.

Shared accessibility fixes are also included verbatim in the independent issue-61 branch, so its strict axe gate can pass without a stacked PR dependency. Browser test fixtures are test-only; production fetching behavior is unchanged.

Axe and scripted keyboard checks are not a certification or a physical screen-reader audit. Native screen-reader speech output has not been verified. Google fonts and upstream/CDN scripts are blocked in deterministic tests; live CDN behavior is outside this audit.

## Verified results

The previously verified executable head `06ec1d5` passes **808 tests across 78 files**, with **100% statements (4786/4786), branches (3093/3093), functions (1239/1239), and lines (4295/4295)**. Whole-PR changed executable coverage is **115/115**, with no uncovered or missing measured files. Shared baseline tests close the previously reported 13 branch gaps through real supported fallback paths. No coverage exclusions were added.

The standalone built-Worker suite passes **49/49 Chromium checks**: all-route axe scans in both themes, all-route 320/390px overflow checks, native API contracts, responsive keyboard/dialog/locale behavior, reduced motion, editor escape, event-count announcements, minimum clear-button target size and visible-label matching for the locale control. TypeScript, lint and production build pass. GitHub CI and preview passed for this executable head.

An actual T3 collaborative-browser pass at 320px confirmed the visible 3px skip-focus outline, Enter focus on main, mobile menu reachability, no overflow, locale inheritance, named English command dialog, Escape close/focus return and theme switching. Both-theme route axe scans and screenshot regression run in the independent issue-61 suite. The standalone accessibility branch includes its own all-route axe and responsive keyboard gate.

## Bot-review follow-up

Editor Escape navigation is consumed by one Tab and cleared on blur; keyboard re-entry restores indentation. The marquee control is hidden while reduced motion makes scrolling static. Locale-control names reference separate language-tagged elements, and remaining static Odia fragments/input examples carry `lang=or`; the glyph has an English accessible description. The browser suite verifies these behaviors and equality of Worker/browser JavaScript clocks fixed at 2026-10-12.

## Modifier-event follow-up — 2026-10-13

Escape’s one-shot Tab latch now survives modifier-only keydown events (Shift, Control, Alt, Meta and AltGraph). Ordinary typing still cancels it; consumed Tab and blur clear it. Regression tests emit Shift keydown before Shift+Tab rather than merely setting `shiftKey`. The actual Chromium suite verifies backward Escape navigation leaves the editor without changing code, then re-entry restores normal indentation. This focus trap was reproduced in the shared PR #134 built-Worker before the fix; the independent accessibility branch now passes all 49 browser checks and its normal full coverage hook. Types, production build and lint pass. Logs are `/tmp/pr132-shift-*.log`; the complete main-diff assessment is `/tmp/pr132-shift-full-diff.json`.

## Dynamic language and live-region follow-up — 2026-10-13

Catalog video headings and channel names now preserve their text in separate Odia-script and English language runs. Thumbnail images have empty alternative text because the adjacent heading already names the video link; this avoids flattening a mixed-language title into one image name. These annotations preserve the English main-landmark boundary and remain correct in both document locales.

The event-filter count region is mounted empty before filtering, outside entrance-animation wrappers, and the same polite, atomic element updates on the first search, type or community filter and subsequent clears. The separate pagination count remains independent. The Worker/browser clock test now blocks all foreign origins before navigation, matching the rest of the deterministic suite.

A real Chromium pass against the previous built Worker reproduced both missing title-language runs and the missing initial filter-count region. A unit regression also failed before the live-region fix. The focused unit suite now passes 34 cases; the rebuilt Worker passes all 50 standalone accessibility browser checks, including the unchanged element across first filter/clear, the actual recorded mixed Odia/English title in both UI locales, deterministic clocks, route/theme axe scans, narrow layouts and keyboard navigation. Types and production build pass. The frozen executable source `eba367753542f3fac9eef00c6fd5b9c4bb344ab5` passes its normal full hook: **813 tests across 78 suites**, **100% statements (4,789/4,789), branches (3,101/3,101), functions (1,241/1,241), and lines (4,298/4,298)**. The complete origin/main diff is **131/131** changed executable lines with zero uncovered or missing files. Lint passes with zero errors and 18 existing warnings. Detailed local logs, raw browser results and the source manifest are in `.lavish/p1-review-followup/`. No physical screen-reader speech claim or native wording approval is made.

## Reduced-motion timeline and restoration announcements — 2026-10-13

Timeline navigation now checks the reduced-motion preference at click time, bypasses Lenis animation, and uses instant native scrolling. The marquee’s Pause/Resume action label no longer carries `aria-pressed`; the changing action label conveys what the button will do. The persistent event count region always contains text, including the restored unfiltered count after the last filter clears. Its DOM identity, polite updates, and atomic announcements are preserved.

Four focused assertions reproduce the preceding implementation’s failures: changing action labels with a pressed state, a missing restored count, and animated timeline scrolling with and without Lenis. The corrected focused suite passes 36 cases. Real browser checks cover the corresponding native-scroll calls, Lenis bypass, clear-message restoration, and marquee semantics. Final full-hook and browser results are recorded below after the frozen source is verified. Detailed logs are in `.lavish/p1-review-followup/pr132-motion-clear-*.log`. These scripted checks do not certify physical screen-reader speech.
