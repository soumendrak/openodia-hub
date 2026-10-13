# Issue #110 verification

## Contract and scope

Reviewed corrections are version-controlled in `src/data/event-overrides.ts` (empty production registry), with a validated additive D1 sidecar cache. The canonical URL identifies the event. Explicit reviewed fields survive unreviewed ingestion; newer independent corrections preserve previously reviewed fields they do not replace. Cancellation, registration availability, attendance eligibility, and date-derived active status are separate.

The crawler's known-URL skip is covered as manual-correction behavior. No automatic change detection, production synthetic events, production migration, deployment, calendar export, or notifications are included. The existing maintainer hold on storage/precedence is addressed by the reviewable contract in `docs/event-lifecycle.md`; applying the migration remains a release decision.

## Verification evidence

- Real local Miniflare D1 tests apply schema plus the additive migration twice, preserve existing rows, round-trip future cancellation/closed registration/eligibility/notices, and prevent older or independent updates from losing reviewed facts.
- Real D1 route tests exercise TanStack API, RSS, and search, including reviewed curated events with no base D1 row and separate request databases. AsyncLocalStorage tests overlap asynchronous requests and nest an unbound context.
- Lifecycle tests exercise every typed state, invalid evidence and dates, contradictory replacement/start/end dates, a genuine replacement date across years, explicitly reviewed new duration, canonical redirect deduplication, and known-URL crawler skip behavior.
- Route tests render cancelled/postponed events in a separate visible section, keep attendance independent, include persisted SSR corrections and structured data, and restore idle pagination after clearing a cached full-corpus search.
- Legacy/missing-sidecar fallback keeps checked-in corrections. Other persistence errors retain a marked partial fallback and do not retry a broken binding. Invalid persisted payload diagnostics omit private payload details.

The original source verification below is historical. Current PR #133 follow-up evidence appears at the end; its normal commit hook and built fixture are rerun on the changed source.

## Built Worker and manual UX

`bun run build` passes. `node docs/verification/fixtures/issue-110-worker.mjs --serve` runs the actual `dist/server` artifact in a local Miniflare Worker with local D1/KV and a blocked upstream network. It checks API cancellation/closed registration, postponed active suppression, replacement dates, search summaries, escaped RSS, and SSR/JSON-LD. Schema and migration are applied twice. The committed fixture is reproducible and never binds production services.

T3 browser tab 8 exercised the built fixture at port 9110 on 2026-10-12:

- 1280×800, 390×844 and 320×812; light and dark themes. All six fixture cards fit their containers, including 500-character uninterrupted notice text. No horizontal document or card overflow and no nested anchors.
- Cancelled and unresolved postponed entries have no Upcoming badge and sit in a visible separate section on the unfiltered page. Unknown registration stays unknown; closed/sold-out/waitlist/not-open/open labels remain separate from eligibility.
- Rescheduling shows the actual new date and separately labels the original date. Lifecycle/registration/notice evidence links have distinct destinations and checked timestamps.
- Clear Filters removes the URL query and restores Load more after a cached full-corpus response. Cancelled/postponed entries remain excluded from Upcoming.
- Keyboard Tab begins at Skip to content. The real browser receives reviewed metadata in its initial server-rendered HTML; corrections do not wait for client fetching.

Local screenshots (T3 artifact paths):

- Desktop light: `/Users/soumen/.t3/userdata/browser-artifacts/browser-screenshot-127-0-0-1-mv5f9tn1-4116ecf1.png`.
- Mobile dark: `/Users/soumen/.t3/userdata/browser-artifacts/browser-screenshot-127-0-0-1-mv5fa1rx-1072f29e.png`.
- 320px dark/light changed section: `/Users/soumen/.t3/userdata/browser-artifacts/browser-screenshot-127-0-0-1-mv5fb84j-a5796ee1.png`, `/Users/soumen/.t3/userdata/browser-artifacts/browser-screenshot-127-0-0-1-mv5fbz3w-e5f8b5dd.png`.

Machine evidence resides in `/tmp/openodia-110-verified/worker-fixture.json` and `worker-events.html`. These are local verification artifacts, not production records.

## Previous automated gates

- Full repository: **82 suites, 856 tests**, all pass.
- Coverage: **100% statements (4,972/4,972), branches (3,383/3,383), functions (1,276/1,276), lines (4,446/4,446)**. No coverage exclusions were added.
- Required review-fix gates: **90/90** and **27/27 changed executable lines**. Against the complete `origin/main` diff (including shared baseline improvements): **815/815**, no missing measured files.
- `bun run lint`: zero errors; 18 existing Fast Refresh warnings. `bunx tsc --noEmit` and `bun run build` pass.
- The built Worker fixture API/search/RSS/SSR gate passes with local D1/KV. No production migration ran.

Coverage JSON and commit-gate log are backed up under `/tmp/openodia-110-verified/`. The repository coverage result is reported separately from changed-line coverage; both are 100%.

The complete `bun scripts/check-pattachitra.mjs http://127.0.0.1:9110` checklist passes against the built local Worker fixture: responsive pages, loaded art, no console errors, light/dark contrast, keyboard search, community/channel names, hover geometry, animation timing, and reduced motion. The fixture seeds checked-in channel shells for unrelated Tutorials layout checks. An initial attempt encountered two transient external browser network errors; the clean retry passed every check. Final log: `/tmp/110-design-check-final.log`.

## Earlier PR review findings

All six concrete Codex findings on PR #133 were reproduced and fixed: failed-D1 fallback, alias canonicalization on every surface, active-first pagination, dedicated registration URL, archive-only override persistence, and equal-day independent review fields. No Grok review was present when these findings were read.

Real local D1 tests exercise same-day concurrent writes and preserve whole conflicting lifecycle objects while unioning independent fields. Empty upstream scrape tests verify override-only sidecar persistence without fabricating an events row. API, Worker, RSS and search tests verify partial fallback without repeated database reads. Redirect tests use real 302 Location followed by final HEAD success, reject unsafe/missing locations and loops, and share one deadline across the bounded chain. They do not invent a changed Response.url on a 200 response.

The final built Worker fixture uses a direct local outbound service to preserve HTTP redirect semantics; Miniflare's fetchMock adapter auto-followed redirects and hid Location even for manual mode. API, search, RSS, and SSR collapse stale aliases with different dates into one reviewed cancellation. A broken-D1 fixture returns a marked no-store fallback. Active records precede archive rows before pagination.

T3 state checks verified registration destinations and canonical cancellation. Its desktop host subsequently disconnected and explicitly instructed no retries. Playwright finished the same built Worker at 320px and 1280px in both themes: separate registration/evidence destinations, six correctly wrapped cards, no nested anchors or overflow, one cancelled canonical alias, and zero page errors. Screenshots: `/tmp/openodia-110-verified/review-320-light.png`, `review-320-dark.png`, `review-1280-light.png`, `review-1280-dark.png`; machine evidence: `review-browser.json`. Final logs: `/tmp/133-review-final-worker-failure.log`, `/tmp/133-review-final-gate.log`, `/tmp/133-review-final-build.log`, `/tmp/133-review-final-types.log`, `/tmp/133-review-final-lint.log`.

## Current PR #133 follow-up

The three additional findings are request-time redirect fan-out, lost live-source failure state, and the editor Escape latch. `test/p1-lifecycle-regressions.test.ts` and editor tests first reproduced **six failures/two passes** against the prior source (`/tmp/pr133-regressions-red.log`). The initial focused gate passes **70 tests in ten files** (`/tmp/pr133-final-focused.log`).

Local D1 fixtures verify 114 live rows in at most eight queries with one bound parameter per write, five chapter GETs plus 30 HEAD attempts, per-hop budgeting/concurrency, rotation, and canonical cancellation/closed-registration persistence after the old alias row and review are removed. Failed chapters do not retire old rows. API/RSS/search failure fixtures remain partial and no-store; a stalled response body is aborted at its deadline. Two fresh module instances serving 114 archive URLs issue zero HEADs. The editor matches the current PR #132 implementation and covers latch consumption, blur/re-entry, and a real Shift-key event before reverse Tab.

The built fixture now applies `0003_event_destination_aliases.sql` twice, seeds the stored redirect and 114 archive URLs, and asserts zero HEAD requests across Worker API/search/RSS/SSR. All bindings are local. The combined release migration order is 0001 (source health), 0002 (reviewed metadata), 0003 (destination aliases); no production migration or deployment runs here. Fresh build/types/lint, normal hook, built API and browser logs use `/tmp/pr133-*` paths. The original 856-test coverage figures above are not current-source claims.

Current-source normal hook at `dac84f9`: **870 tests in 85 suites**, **100% statements 5,073/5,073, branches 3,432/3,432, functions 1,308/1,308, lines 4,543/4,543**; staged changed executable lines **265/265**. The subsequent gap-focused gate passes **20/20** in three files (`/tmp/pr133-final-gaps-focused.log`), including malformed upcoming/past collections, independent bulk review fields, and corrupt alias observation timestamps. No exclusions or thresholds changed.

The complete diff against `origin/main` at `a440393` covers **1022/1022** measured executable lines with no missing files. Build, types, lint (zero errors/18 existing warnings), and the refreshed built Worker pass. The actual scheduled fixture at 06:15 UTC writes 114 rows using five chapter GETs plus 30 HEADs and no catalog requests. Real Ego browser input verifies Escape + Shift+Tab exit, re-entry indentation, and blur/re-entry indentation; the Events page has one canonical cancelled record, no old alias, cancelled JSON-LD, and no horizontal overflow. Local screenshots and browser evidence are backed up with the logs/coverage JSON under `.lavish/p1-133-followup/`; the committed `p1-133-followup.json` records source/base revisions and the coverage fingerprint.
