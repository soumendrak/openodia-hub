# Search quality gate

## Parent plan

`plan.md` — OpenOdia search improvement plan.

## What to build

Add the automated and manual evidence required to ship the new search safely. Tests must exercise the real matcher and real command components; presentation-only mocks are insufficient for the behaviours that previously escaped coverage.

## Tasks

- [x] Add table-driven unit fixtures for normalization, aliases, Odia/Romanized queries, ranking, thresholds, ties, deduplication, and post-score limits.
- [x] Add integration tests for every source adapter, complete and partial snapshots, cache reuse, validation, and endpoint response bounds.
- [x] Add command-palette tests that type into the real `cmdk` input and assert visible order, keyboard selection, async states, cancellation, retry, and internal/external navigation.
- [x] Add route tests for URL query restoration, shared normalization, facet interaction, and complete event search.
- [x] Add browser checks at 320px, 390px, tablet, and desktop widths.
- [x] Measure warm endpoint latency, response size, and upstream request count; record explicit budgets in the test or architecture documentation.
- [x] Review status announcements, focus restoration, contrast, and touch/keyboard operation.
- [x] Run the full repository quality gate and separate any pre-existing failures from search regressions.

## Acceptance criteria

- [x] The old `first 30 only` failure has a regression test.
- [x] Each supported kind has at least one end-to-end search fixture.
- [x] Exact-title ordering and unrelated-fuzzy rejection are protected by tests.
- [x] Partial and total source failures are distinguishable in API and UI tests.
- [x] Real command filtering/ranking is exercised; matching is not entirely mocked away.
- [x] Superseded requests cannot replace newer results.
- [x] A warm query stays within the recorded latency/response/request-count budgets.
- [x] `pnpm lint`, `pnpm test`, `pnpm build`, and `just coverage` pass before completion.

## Blocked by

- `issues/007-unified-search-service.md`.
- `issues/008-global-search-palette.md`.
- `issues/009-route-search-consistency.md`.

## Completion evidence

- Automated search, adapter, API, command-palette, cancellation, route-query, and performance coverage is part of the 711-test repository suite.
- Responsive, keyboard, touch, focus, accessibility-tree, contrast, endpoint latency, payload, and cache evidence is recorded in [`docs/search-quality.md`](../docs/search-quality.md).
- Typecheck, lint, production build, full tests, and `just coverage` passed on 2026-09-21. Lint retains 18 pre-existing Fast Refresh warnings and no errors.
