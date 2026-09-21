# Global command-palette experience

## Parent plan

`plan.md` — OpenOdia search improvement plan.

## What to build

Replace the palette's four preview fetches and hidden `cmdk` scoring with the unified search service. Preserve lazy loading and keyboard operation while making async state, partial coverage, ranking, and navigation visible and predictable.

## Tasks

- [x] Keep the lightweight `⌘K`/`Ctrl+K` launcher and lazy-loaded dialog boundary.
- [x] Render the static Pages group immediately.
- [x] Debounce non-empty queries and cancel superseded requests.
- [x] Render server-ranked results without applying a second `cmdk` filter or resort.
- [x] Remove all pre-search `slice(0, 30)` behaviour; enforce only post-ranking display limits.
- [x] Add explicit loading, partial-results, total-error, empty, and retry states.
- [x] Group results by kind without hiding higher-scoring matches behind source order.
- [x] Use internal OpenOdia links as the primary selection target and expose upstream links secondarily where useful.
- [x] Preserve focus trapping, arrow-key selection, Enter, Escape, focus restoration, accessible status announcements, and narrow-screen scrolling.

## Acceptance criteria

- [x] Typing a known title outside the former first 30 returns it.
- [x] Models, datasets, and papers render in the global palette.
- [x] The visible order matches the service order.
- [x] A partial response identifies unavailable/stale sources without suppressing healthy results.
- [x] Loading never masquerades as `No results`.
- [x] Retry does not close the palette or erase the query.
- [x] Selecting a resource with a permalink navigates internally; an external-only record still opens safely.
- [x] Mouse, touch, keyboard-only, and screen-reader flows work at 320px and desktop widths.

## Blocked by

- `issues/007-unified-search-service.md`.
