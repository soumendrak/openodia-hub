# Issue #112 — source outcomes and retained canonical event history

## Contract

- Adapters measure `success-empty`, `success-events`, or `failed`. Failures expose only `http`, `timeout`, `parse`, or `network`; response bodies/credentials are not exposed.
- `lastAttemptAt` measures an attempted fetch; `lastSuccessAt` measures successful parsing. Persisted success survives later failed attempts. Editorial `verifiedAt` is independent and never synthesized.
- An eight-second deadline covers headers and body consumption. Each request attempts each source once. The Events client retries a failed API once; there is no upstream retry loop.
- Pagination and completeness remain separate from fetch success. Truncated past lists are partial and cannot retire historical rows. Complete upcoming lists can retire upcoming records.
- Event ownership is a many-to-many source membership. A failed cohost protects its known records. Complete empty snapshots retire only that source's membership; a row retires only when no known active source membership remains.
- Exact organizer registry aliases safely backfill legacy ownership. Unknown/removed legacy sources are retained, requiring editorial reconciliation rather than guessed deletion.
- D1 feeds merge checked-in and persisted events. Without usable D1 data, live events merge with checked-in history. API, Events page, search, and RSS share canonical URL deduplication. No second archive store or route exists.
- APIs return bounded source metadata and `partial`; search marks its event source `partial` and preserves healthy-source/curated events. RSS exposes `X-OpenOdia-Partial`; an empty feed caused by total failure returns 503, while a measured successful-empty feed remains 200. The Events page displays a concise warning without making attendance/registration claims.
- D1 source measurements older than seven hours (six-hour cron plus one-hour tolerance), invalid, missing, failed, or truncated are partial. Missing outcome tables preserve legacy persisted records and expose unknown health rather than invent success.
- Complete API results cache for one hour with a ten-minute stale window. Partial events responses use `no-store`. Search snapshots retain their existing five-minute cache and carry partial status. The cache key is versioned to avoid presenting pre-outcome snapshots as measured health.
- `year` and `sort=oldest` are URL-backed refinements of `/events`; numeric years decoded by TanStack are normalized, and filters fetch the full canonical collection.

## Deployment prerequisite

Apply the additive `db/migrations/0001_event_source_outcomes.sql` to the existing EVENTS_DB before enabling the new cron. Reapplying `db/schema.sql` also creates the new tables without changing/deleting existing events. Registry-alias ownership backfill runs conservatively on sync. An unmigrated DB continues serving known events with `partial=true`; cron refuses before retiring any data.

## Evidence

- Final actual Git pre-commit gate: **81 test files, 866 passing tests; 100% statements (4826/4826), branches (3209/3209), functions (1262/1262), and lines (4336/4336)** across the complete configured repository coverage scope. No coverage exclusions were added. Real Miniflare D1 executes retirement SQL, legacy ownership backfill, 150 IDs, truncated lists, complete empty lists, repeated failed cron runs, and cohost ownership.
- Fixture APIs exercise one healthy source/four HTTP failures, total failures with curated fallback, total failures without fallback (503), malformed JSON/records/dates, network failure, aborted requests, and stalled response bodies. Source metadata never includes sensitive error bodies.
- Browser: T3 collaborative preview on port 9112, desktop 1280 × 800 and mobile 375 × 812. Verified URL-backed year/sort restoration, oldest archive order (2020 through 2026), clear year preserving sort, empty 1999 archive selection/message, partial-source warning, retained cards, and no horizontal overflow.
- Live local API: HTTP 200, 149 canonical retained events, page limit 2 respected, five bounded source outcomes with measured attempt/success timestamps, `partial=true` because all five upstream past lists are truncated, and `Cache-Control: no-store`. This is source measurement, not an editorial or registration verification.
- Adversarial browser check found TanStack numeric-year decoding was dropping/mismatching archive state; fixed with parser normalization and regression tests. Invalid/negative list counts cannot retire stored history. Invalid event dates are parse failures rather than invented calendar dates.
- Changed executable coverage: **510/510 against origin/main**, with no uncovered or missing files. The implementation commit hook verified 499/499 changed lines; the final RSS/coverage follow-up hook verified 12/12. The final origin/main assessment covers the combined change.
- Frozen Bun 1.3.13 install; typecheck passes; lint reports zero errors and 18 existing warnings; production client/Worker build passes. Source, diff, dependency and edge-case review completed with the but-for-real skill.
- Existing PR #119 implementation and follow-up commits were inspected and reused; the final patch extends that safety fix through persistence, API, search, RSS and Events UI. Existing remote history is preserved by an ancestry-only merge with an unchanged tree before fast-forward push.

## Operator checks

Inspect `event_source_status` for `outcome`, `last_attempt_at`, `last_success_at`, and completeness flags after cron. A failed attempt may update its attempt timestamp but must preserve the previous success timestamp and active memberships. Verify a mixed-outcome sync leaves failed-source records active, and the next successful-empty sync retires only that source. Unknown legacy ownership is an editorial reconciliation queue, not proof that an event disappeared.
