# OpenOdia Hub — task runner
# Requires: just (https://just.systems), bun, wrangler

# List all available recipes
default:
    @just --list

# Install dependencies
install:
    bun install

# Start the development server
dev:
    bun run dev

# Production build
build:
    bun run build

# Development-mode build
build-dev:
    bun run build:dev

# Preview the production build locally
preview:
    bun run preview

# Run ESLint
lint:
    bun run lint

# Fix auto-fixable lint issues
lint-fix:
    bun run lint --fix

# Format source files with Prettier
format:
    bun run format

# Run tests once
test:
    bun run test

# Type-check with tsconfig.json and the strict tsconfig.strict.json
typecheck:
    bun run typecheck

# Check the English and Odia locale inventory
locales:
    bun run check:locales

# Build, then run the browser checks in the same order as CI's e2e job
e2e: build
    bun run test:bilingual
    bunx playwright test

# Build, then run the accessibility suite
a11y:
    bun run test:a11y

# Check the local toolchain: Bun 1.3+, Node 22+, Playwright Chromium, the pinned zizmor and ss
doctor:
    #!/usr/bin/env bash
    set -uo pipefail
    status=0
    report() { if [ "$2" = ok ]; then echo "ok   $1"; else echo "FAIL $1: $2"; status=1; fi; }
    atleast() { [[ "$1" =~ ^[0-9]+(\.[0-9]+)*$ ]] && [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]; }
    bun_version=$(bun --version 2>/dev/null)
    atleast "$bun_version" 1.3 && report "bun $bun_version" ok || report "bun ${bun_version:-missing}" "install Bun 1.3+"
    node_version=$(node --version 2>/dev/null)
    atleast "${node_version#v}" 22 && report "node $node_version" ok || report "node ${node_version:-missing}" "install Node.js 22+"
    chromium=$(node -e 'process.stdout.write(require("@playwright/test").chromium.executablePath())' 2>/dev/null)
    [ -n "$chromium" ] && [ -x "$chromium" ] && report "playwright chromium" ok || report "playwright chromium" "run bunx playwright install --with-deps chromium"
    pinned=$(sed -n 's/^export const ZIZMOR_VERSION = "\(.*\)";$/\1/p' scripts/standards/zizmor.ts)
    zizmor_version=$(zizmor --version 2>/dev/null)
    zizmor_fix='python3 -m venv "$HOME/.venvs/zizmor" && "$HOME/.venvs/zizmor/bin/pip" install --require-hashes -r scripts/standards/zizmor-requirements.txt, then put $HOME/.venvs/zizmor/bin on PATH'
    [ "$zizmor_version" = "zizmor $pinned" ] && report "$zizmor_version" ok || report "zizmor ${zizmor_version:-missing}" "need zizmor $pinned: $zizmor_fix"
    command -v ss >/dev/null && report "ss (iproute2)" ok || report "ss" "install iproute2; the verify skill needs it on Linux"
    exit $status

# Run all tests and generate the full-repository coverage report
coverage:
    bun run test:coverage

# Activate the version-controlled Git hooks in this clone
hooks-install:
    bun run hooks:install

# Run tests in watch mode
test-watch:
    bun run test:watch

# Run every repository standard against the merge base with origin/main (CI's gate; CI diffs against the tip of main)
check:
    bun scripts/standards.ts --base "$(git merge-base origin/main HEAD)"

# Browser checks for the Pattachitra theme (needs a running server)
check-pattachitra url="http://localhost:9090":
    bun scripts/check-pattachitra.mjs {{url}}

# Deploy to Cloudflare Workers (requires Cloudflare credentials)
deploy:
    bun run build
    npx wrangler deploy

# Remove build artefacts
clean:
    rm -rf dist .wrangler
