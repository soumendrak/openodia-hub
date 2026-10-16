#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
{ git ls-files -co --exclude-standard -z -- src public package.json bun.lock vite.config.ts wrangler.jsonc tsconfig.json; find . -maxdepth 1 -type f -name '.env*' -printf '%P\0'; } | sort -zu | xargs -0 -r sha256sum 2>/dev/null || true
env -0 | { grep -z '^VITE_' || true; } | sort -z | while IFS= read -r -d '' kv; do printf '%s  env:%s\n' "$(printf '%s' "${kv#*=}" | sha256sum | cut -d' ' -f1)" "${kv%%=*}"; done
