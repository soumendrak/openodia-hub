#!/usr/bin/env bash
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
BASE="${1:-origin/main}"
fail=0
step() { echo "== $1"; shift; if "$@"; then echo "PASS"; else echo "FAIL"; fail=1; fi; }
step "locales" bun run check:locales
step "lint (eslint, typescript-eslint)" bun run lint
step "typecheck (tsc strict, tsconfig strict:true)" bunx tsc --noEmit -p tsconfig.json
step "unit tests + 100% changed-line coverage vs $BASE" bun run test:coverage:diff -- --base "$BASE"
added="$(git diff -U0 "$BASE" -- 'src/**' 'scripts/**' 'test/**' '*.ts' '*.tsx' '*.mjs' '*.js' ':!**/*.md' ':!.cursor/**' ':!src/routeTree.gen.ts' | grep -E '^\+[^+]' | grep -E '^\+\s*(//|/\*|\*\s|\*/|\{/\*)' || true)"
echo "== no new code comments vs $BASE"
if [ -n "$added" ]; then echo "$added"; echo "FAIL"; fail=1; else echo "PASS"; fi
[ "$fail" = 0 ] && echo "STANDARDS OK" || { echo "STANDARDS FAIL"; exit 1; }
