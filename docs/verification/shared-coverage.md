# Shared baseline branch-coverage verification

This change covers meaningful fallback behavior previously missing from the full-suite branch report:

- Empty search summaries display the source; a result without a destination closes safely without navigating or opening an empty external URL.
- A slash shortcut before the input ref attaches safely prevents the browser shortcut without dereferencing null. Ordinary keys and Escape in another typing surface preserve focus and browser key handling.
- Identical search titles and scores use stable IDs to keep ordering deterministic across input order.
- A rejected live-event search source retains curated archive events and healthy catalog results while reporting unavailable source status.
- Video API errors distinguish upstream unavailability (503) from sanitized internal failure (500), including JSON and CORS headers.
- Existing injected chapter adapters without organizerId still resolve legacy aliases consistently through the real event parser, direct API, RSS and D1 persistence. The fixture restores the configured chapter registry after every test; it does not mock adapter function signatures.

One redundant diagnostic fallback was removed from the crawler. Every published organizer has at least one official link, as required by the reviewed registry validation. When no link label is supplied the default link therefore exists; a missing-link error can only describe an explicitly requested label. The unreachable `linkLabel ?? "official"` branch was removed without changing diagnostics for supported inputs. No invalid registry fixture or coverage ignore was added.

Targeted verification: six suites, 54 tests pass; changed files pass ESLint and repository TypeScript validation. The existing staged pre-commit coverage gate runs the full suite before committing. Runtime: Bun 1.3.13 with VITEST_MAX_WORKERS=2. No coverage exclusions or thresholds were weakened.
