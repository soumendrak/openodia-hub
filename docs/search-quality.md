# Search quality gate

Verified on 2026-09-21 against the local development build. These are release
regression budgets for the unified search added in `src/lib/search.ts` and
`src/routes/api/search.ts`; they are not production availability SLOs.

## Automated budgets

| Measure                                 |      Budget | Gate                                  |
| --------------------------------------- | ----------: | ------------------------------------- |
| Warm ranking p95 over 5,000 documents   |  `< 250 ms` | `test/search-quality-budget.test.ts`  |
| Maximum API results                     |        `50` | API contract and integration tests    |
| Serialized 50-result fixture response   | `< 256 KiB` | `test/search-quality-budget.test.ts`  |
| Repeated warm snapshot upstream fan-out |         `0` | snapshot cache-reuse integration test |

The ranking test warms the normalized document index before taking 20 samples.
The source integration test calls the same cached snapshot loader twice and
requires every upstream adapter to have run exactly once.

## Live local endpoint evidence

Query: `/api/search?q=odia&limit=50`

| Run                       | Cache  |    Duration | Response size |
| ------------------------- | ------ | ----------: | ------------: |
| Cold development snapshot | `MISS` | 17,418.2 ms |  31,843 bytes |
| Warm 1                    | `MEMO` |     80.2 ms |  31,843 bytes |
| Warm 2                    | `MEMO` |     52.7 ms |  31,843 bytes |
| Warm 3                    | `MEMO` |     66.9 ms |  31,843 bytes |

The warm endpoint satisfies its tighter 150 ms live-review budget and the 256
KiB payload budget. The cold local measurement includes the complete uncached GitHub, Hugging Face, paper,
YouTube, and event fan-out. Production normally reuses the existing KV-backed
source caches and the five-minute search snapshot, but the cold number remains
documented rather than being presented as warm performance.

## Browser and accessibility evidence

- Browser: ego-browser Chromium 152 against `http://localhost:9090`.
- Widths checked: 320, 390, 768, and 1280 CSS pixels.
- No horizontal document overflow at any checked width.
- Palette widths were 320, 390, 512, and 512 pixels respectively; the results
  list remained vertically scrollable.
- The dialog, combobox, suggestions list, groups, and options had semantic
  names in the accessibility snapshot.
- Mouse, keyboard, and emulated touch opened the palette.
- Arrow-key movement plus Enter selected an internal result; Escape closed the
  dialog and restored focus to the launcher button.
- Direct URLs restored `q` on Tools, Models, Datasets, Papers, Tutorials, and
  Events; browser Back restored `/models?q=odia` and its input value.
- A palette result navigated to the stable internal dataset permalink.
- Measured dark-theme contrast ratios: input text 13.95:1, placeholder/muted
  text 7.05:1, and selected result text 5.60:1. A selected-summary contrast bug
  discovered during review was corrected to use the selected foreground.

## Covered failure and completeness cases

- Result beyond position 30 and post-score limits.
- Every supported result kind and its preferred destination.
- Odia script, `Odia`/`Oriya`, and curated Romanized-Odia aliases.
- Exact-title ordering, deterministic ties, typo bounds, deduplication, and
  unrelated fuzzy rejection.
- Partial source failure, total service failure, API validation, response
  bounds, and snapshot cache reuse.
- Real `cmdk` rendering, server order, keyboard selection, internal/external
  navigation, async states, retry, and superseded-request cancellation.
- Full-corpus event search and URL-backed query state on all six content routes.
