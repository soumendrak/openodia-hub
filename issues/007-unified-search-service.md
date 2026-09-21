# Unified cached search service

## Parent plan

`plan.md` — OpenOdia search improvement plan.

## What to build

Build one server-side search service and `/api/search` endpoint over the complete supported corpus. Adapt static pages, the unified catalog, papers, tutorials, and curated/live events into the shared document contract. Reuse existing source caches and add a bounded search snapshot so requests do not repeat the upstream fan-out for every keystroke.

## Tasks

- [x] Add source adapters for static pages, unified catalog resources, papers, videos/channels, and events.
- [x] Use the unified catalog to deduplicate repositories, tools, models, and datasets before indexing.
- [x] Give every document a stable identity plus internal and upstream destinations where available.
- [x] Build the snapshot with independent settled source results and explicit freshness metadata.
- [x] Define snapshot TTL, stale-while-refresh behaviour, concurrency control, and failure fallback.
- [x] Implement `/api/search` query validation, optional kind scoping, post-ranking limits, and a bounded response shape.
- [x] Return source availability/staleness metadata so clients can distinguish complete from partial results.
- [x] Ensure superseded or repeated client queries reuse the snapshot rather than re-running upstream loaders.

## Acceptance criteria

- [x] The endpoint returns static pages, repositories/tools, models, datasets, papers, tutorials, and events.
- [x] No source is sliced before matching or scoring.
- [x] A fixture beyond the old 30-item boundary is returned.
- [x] Duplicate catalog records produce one result with the preferred internal permalink.
- [x] One rejected source loader still returns healthy matches and marks the response partial.
- [x] A total service failure returns a typed, non-200 error rather than a misleading empty success.
- [x] Query length, requested limits, and response size are bounded.
- [x] Warm repeated searches do not repeat upstream network fan-out.
- [x] Raw query strings are not written to analytics or application logs.

## Blocked by

- `issues/006-search-contract-ranking.md`.

## Not part of this task

- Palette rendering.
- Route-level query-state changes.
