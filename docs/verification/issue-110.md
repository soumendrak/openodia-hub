# Issue #110 verification

## Contract and scope

Reviewed corrections are version-controlled in `src/data/event-overrides.ts` (empty production registry), with a validated additive D1 sidecar cache. The canonical URL identifies the event. Explicit reviewed fields survive unreviewed ingestion; newer independent corrections preserve previously reviewed fields they do not replace. Cancellation, registration availability, attendance eligibility, and date-derived active status are separate.

The crawler's known-URL skip is covered as manual-correction behavior. No automatic change detection, production synthetic events, production migration, deployment, calendar export, or notifications are included. The existing maintainer hold on storage/precedence is addressed by the reviewable contract in `docs/event-lifecycle.md`; applying the migration remains a release decision.

## Verification evidence

- Real local Miniflare D1 tests apply schema plus the additive migration twice, preserve existing rows, round-trip future cancellation/closed registration/eligibility/notices, and prevent older or independent updates from losing reviewed facts.
- Real D1 route tests exercise TanStack API, RSS, and search, including reviewed curated events with no base D1 row and separate request databases. AsyncLocalStorage tests overlap asynchronous requests and nest an unbound context.
- Lifecycle tests exercise every typed state, invalid evidence and dates, contradictory replacement/start/end dates, a genuine replacement date across years, explicitly reviewed new duration, canonical redirect deduplication, and known-URL crawler skip behavior.
- Route tests render cancelled/postponed events in a separate visible section, keep attendance independent, include persisted SSR corrections and structured data, and restore idle pagination after clearing a cached full-corpus search.
- Legacy/missing-sidecar fallback keeps checked-in corrections. Other persistence errors are not reported as successful empty data. Invalid persisted payload diagnostics omit private payload details.

Final build, whole-repository coverage, built Worker fixture, and browser evidence are recorded below after execution.

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
