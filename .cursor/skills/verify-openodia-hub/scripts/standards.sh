#!/usr/bin/env bash
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
BASE_REF="${1:-origin/main}"
BASE="$(git merge-base "$BASE_REF" HEAD)" || { echo "cannot find merge base of $BASE_REF and HEAD: fetch it or pass an existing ref"; echo "STANDARDS FAIL"; exit 2; }
echo "diff base: merge-base($BASE_REF, HEAD) = $BASE"
fail=0
bun_ok() { bun --version 2>/dev/null | awk -F. '{exit !($1 > 1 || ($1 == 1 && $2 >= 3))}'; }
bun_ok || { echo "bun 1.3+ required (CONTRIBUTING.md); found $(bun --version 2>/dev/null || echo none)"; echo "STANDARDS FAIL"; exit 2; }
echo "== install locked dependencies"
bun install --frozen-lockfile || { echo "bun install --frozen-lockfile failed"; echo "STANDARDS FAIL"; exit 2; }
untracked="$(git ls-files --others --exclude-standard -- src scripts test db public '*.ts' '*.tsx' '*.mjs' '*.js' | grep -v '^\.cursor/' || true)"
echo "== untracked source files"
if [ -n "$untracked" ]; then echo "$untracked"; echo "diff gates cannot see these: run git add -N <file> (or stage them) and rerun"; echo "FAIL"; fail=1; else echo "PASS"; fi
step() { echo "== $1"; shift; if "$@"; then echo "PASS"; else echo "FAIL"; fail=1; fi; }
step "locales" bun run check:locales
step "lint (eslint, typescript-eslint)" bun run lint
step "typecheck (tsc strict, tsconfig strict:true)" bunx tsc --noEmit -p tsconfig.json
step "unit tests + 100% changed-line coverage vs $BASE" bun run test:coverage:diff -- --base "$BASE"
blank() { perl -0777 -pe 's/("(?:[^"\\\n]|\\.)*")|(\x27(?:[^\x27\\\n]|\\.)*\x27)|(`(?:[^`\\]|\\.)*`)/defined $1 ? "\"\"" : defined $2 ? "\x27\x27" : do { my $t = $3; my $n = ($t =~ tr!\n!!); "`" . join(" ", map { s!\s+! !gr } $t =~ m!\$\{((?:[^{}]|\{(?1)\})*)\}!g) . "`" . ("\n+" x $n) }/ge'; }
added="$(git diff -U0 "$BASE" -- 'src/**' 'scripts/**' 'test/**' '*.ts' '*.tsx' '*.mjs' '*.js' ':!**/*.md' ':!.cursor/**' ':!src/routeTree.gen.ts' | grep -E '^\+[^+]' | blank | perl -pe 's{(^\+|[=(,:!&|?{};]|\breturn)(\s*)/(?![/*])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n\[])+/[a-z]*}{$1$2/re/}g' | grep -E '^\+\s*(\*\s|\*/)|(^\+|[^:])//|/\*' || true)"
echo "== no new code comments vs $BASE"
if [ -n "$added" ]; then echo "$added"; echo "FAIL"; fail=1; else echo "PASS"; fi
[ "$fail" = 0 ] && echo "STANDARDS OK" || { echo "STANDARDS FAIL"; exit 1; }
