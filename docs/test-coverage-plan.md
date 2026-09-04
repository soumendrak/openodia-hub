# Repository test-coverage plan

Baseline on 2026-09-03: 26.67% lines (1,013/3,798) with 237 passing tests.

Current verified result: 78.34% lines (2,977/3,800) with 318 passing tests. The suite added in
this pass covers route rendering, root and server entry points, public API routes, source adapters,
maintenance scripts, the command palette, keyboard shortcuts, forms, charts, carousels, sidebars,
menus, overlays, calendars, and other shared UI primitives.

Target: 100% line coverage for repository-owned executable TypeScript and JavaScript. Generated
route output and the coverage-gate entrypoint remain visible in the full report; any exclusion must
be explicit and justified rather than used to inflate the result.

## Work packages

- [x] Coverage infrastructure: full JSON/text reports, a 100% changed-line gate, pre-commit hook,
      and the matching CI deployment gate.

- [ ] Route rendering: render every page with empty, populated, loading, and failure data where the
      page has distinct behavior.
- [ ] UI behavior: cover shared components, hooks, dialogs, keyboard behavior, and Radix wrappers.
- [ ] Server/API behavior: cover every response path, D1 fallback, cache header, redirect, and error
      branch.
- [ ] Source adapters: cover successful, malformed, empty, paginated, rate-limited, and failed
      upstream responses.
- [ ] Event crawler: extract or invoke every decision path and cover redirects, duplicates, writes,
      deactivation, and CLI failures.
- [ ] Maintenance scripts: cover link checking, contributor sync, OG generation, and coverage-gate
      behavior without live network or destructive writes.
- [ ] Entry points and generated/declarative modules: test owned behavior; explicitly classify code
      that is generated or only framework bootstrap output.
- [ ] Residual sweep: use the JSON report to eliminate every remaining uncovered executable line,
      then enable and verify a 100% global line threshold.

## Acceptance checks

1. `just coverage` exits successfully at 100% lines.
2. `just coverage-diff` still rejects a deliberately uncovered changed line.
3. `bun run lint`, `bun x tsc --noEmit`, and `bun run build` pass.
4. CI uses the same coverage command and cannot deploy a failing revision.
