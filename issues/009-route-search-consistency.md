# Route-search consistency and deep links

## Parent plan

`plan.md` — OpenOdia search improvement plan.

## What to build

Align Tools, Models, Datasets, Papers, Tutorials, and Events with the shared normalization and searchable-field policy while preserving their route-specific facets and cards. Make meaningful search state linkable and ensure pagination does not make valid records unsearchable.

## Tasks

- [x] Inventory and document each route's searchable fields against the shared contract.
- [x] Replace ad hoc lowercase/substring normalization with the shared query normalizer and route-appropriate scorer/predicate.
- [x] Store non-empty `q` in route search parameters with bounded validation and back/forward support.
- [x] Preserve the existing rule that free text narrows the facet vocabulary before cross-filter counts are calculated.
- [x] Keep OR-within-facet and AND-across-facets semantics unchanged.
- [x] Make event search query the complete event corpus rather than only client-loaded pages.
- [x] Add stable anchors or scoped route links for event, tutorial, and paper results so global selection lands on useful in-site context.
- [x] Keep `/` focus and Escape behaviour consistent across routes without stealing keys from editing controls.

## Acceptance criteria

- [x] Equivalent queries follow the same normalization policy on all six routes.
- [x] Copying a URL with `q` restores the same query and result set after reload.
- [x] Browser back/forward restores query state without stale cards.
- [x] Search plus facets retains accurate cross-filter counts.
- [x] Searching Events finds a matching record not present in the pages previously loaded by the visitor.
- [x] Empty, partial, and no-match states provide a recovery action.
- [x] Existing card rendering, Load More behaviour outside active search, and route metadata remain intact.

## Blocked by

- `issues/006-search-contract-ranking.md`.

## Coordination

- Coordinate the complete-event query path and result destinations with `issues/007-unified-search-service.md`.
