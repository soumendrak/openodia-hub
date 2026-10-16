#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git ls-files -co --exclude-standard -z -- src public package.json bun.lock vite.config.ts wrangler.jsonc tsconfig.json | sort -z | xargs -0 -r sha256sum 2>/dev/null || true
