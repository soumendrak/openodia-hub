# Issue #57 verification

## Implemented scope

The explicit inventory contains 46 UI strings: navigation and language/control labels, home hero/opening/statistics and footer. English and Odia render through the existing provider; localized sections carry the selected language while untranslated page bodies remain marked English. The public `/translation-status` page and `/api/translation-status` distinguish translation presence from exact-wording native review. The API is documented in OpenAPI and discovery.

New English keys require a tracking entry and an explicit Odia translation or blank placeholder. Unknown keys, missing placeholders, invalid Odia wording and mismatched interpolation tokens fail the locale CLI/CI gate. Tracked placeholders remain visibly missing, not translated. The contributor path supports a single string and direct GitHub edits.

The native-review workflow reads GitHub API metadata without checking out or executing PR code with write permissions. It adds `needs-native-speaker-review` and requires an actual configured native review of the current commit. Stale, outsider, dismissed and revoked approvals do not count. A configured native reviewer using the same account that authored an agent PR can give an explicit SHA-bound review comment; ownership alone is not approval. Exact wording, reviewer and date are recorded separately in `ODIA_REVIEWS`.

## Verification

- Production client/Worker build and typecheck pass; lint has zero errors and 18 existing Fast Refresh warnings.
- `bun run test:bilingual` starts a hermetic built Miniflare Worker, denies upstream networking, seeds recorded catalog fixtures and runs Chromium. **32 layout/axe checks** cover two routes, both locales, both themes and 320/390/768/1280px. Locale persistence, hero/footer language, search/checkbox/empty-state recovery, API status/CORS/cache/counts and absence of page errors pass. Axe uses all WCAG 2.1 A/AA tags; reduced motion stabilizes the automation matrix.
- T3 manual checks on port 9157 verified the live API, exact English/Odia pair search, direct edit link, empty state and persistence through full navigation. The 320px search control is 273px wide, with no horizontal overflow. The initial narrow-layout audit caught and fixed a 29px search field. Live T3 axe scans of translation status passed both themes at all four widths. The collaborative browser later disconnected; the remaining matrix used the committed built-Worker harness.
- Unit tests cover tracked placeholders, missing registrations, unknown keys, invalid dates/text, interpolation, changed-wording review invalidation, API discovery and future reviewed/missing/empty dashboard states. Workflow tests execute the actual YAML script against GitHub API fixtures and verify approval/revocation and permission boundaries.
- Shared baseline fallback/keyboard tests close existing coverage gaps; no new coverage exclusions were added. Shared accessibility fixes keep skip focus, language annotations, focus contrast, editor escape and reduced-motion behavior compatible with bilingual controls.

## Native review still pending

The user agreed to review the Odia wording. The repository reviewer variable is configured for `soumendrak`; **no approval or review date was invented**. All 46 strings remain drafts with `ODIA_REVIEWS = {}` and the public reviewed count is zero. The workflow must land on the default branch before all of its event triggers operate. After this workflow first lands, maintainers should require its `native-review` check in main branch protection. This first PR is manually labelled for native review; keep #57 open until its first-batch native review criterion is complete.

The scoped 100% translation presence is not a claim of full-site translation or linguistic certification. Physical screen-reader speech is not audited by automated axe checks.

## Final automated results

The final actual pre-commit gate passes **858 tests across 81 suites**. Full configured repository coverage is **100% statements (4,847/4,847), branches (3,143/3,143), functions (1,255/1,255), and lines (4,344/4,344)**. The complete `origin/main` diff covers **419/419 executable lines**, with no uncovered or missing measured files. The implementation hooks independently checked 341/341, 19/19 and the final placeholder change 1/1 staged executable lines. Coverage and logs are backed up under `/tmp/openodia-57-verified/`.

Reproduce with a frozen modern Bun install, `bun run check:locales`, `bun run test:coverage`, `bun x tsc --noEmit`, `bun run lint`, `bun run build`, and `bun run test:bilingual`. Screenshots and machine results are written to `/tmp/openodia-bilingual-browser`; CI uploads them as bilingual-browser-evidence.
