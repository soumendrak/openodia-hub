# Search contract, normalization, and ranking

## Parent plan

`plan.md` — OpenOdia search improvement plan.

## What to build

Create the pure, source-independent foundation for search. Define the typed document/result contract, query normalization, field weighting, deterministic scoring, stable tie-breaking, deduplication keys, and result grouping. The module must work in server and browser code without importing React, route loaders, or network clients.

## Tasks

- [x] Define `SearchKind`, `SearchDocument`, `SearchResult`, source-status, and query-option types.
- [x] Specify which fields are searchable and how title, identifiers, people/organisations, categories/tasks, tags, descriptions, and aliases are weighted.
- [x] Normalize Unicode, case, punctuation, separators, and repeated whitespace without damaging Odia grapheme sequences.
- [x] Treat `Odia` and `Oriya` as documented aliases.
- [x] Choose and document a deterministic Romanized-Odia strategy. Use representative fixtures to prove both script and Romanized queries; do not silently claim general transliteration support from a tiny synonym list.
- [x] Implement exact, prefix, token, metadata, description, and bounded typo-tolerant scoring in the documented order.
- [x] Add stable tie-breakers and canonical-identity deduplication.
- [x] Apply global/per-kind limits only after all candidate documents have been scored.

## Acceptance criteria

- [x] A record at input position 31 or later can outrank earlier records and be returned.
- [x] Exact normalized title matches outrank prefix, metadata, description-only, and fuzzy matches.
- [x] Obviously unrelated subsequence matches score zero or below the inclusion threshold.
- [x] `Odia`/`Oriya`, Odia-script, and agreed Romanized fixtures have explicit expected results.
- [x] Unicode normalization tests include Odia text and preserve meaningful script content.
- [x] Duplicate documents sharing a canonical permalink/identity collapse predictably.
- [x] Identical input produces identical ordering.
- [x] The module has no network, framework, or DOM dependency.

## Blocked by

None.

## Not part of this task

- Fetching source data.
- Building an API route.
- Changing the palette UI.
