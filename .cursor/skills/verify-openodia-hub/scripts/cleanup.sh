#!/usr/bin/env bash
set -uo pipefail
PORT="${VERIFY_PORT:-9171}"
RUN="${VERIFY_DIR:-/tmp/verify-openodia-hub}"
cd "$(git rev-parse --show-toplevel)"
pid="$(cat "$RUN/server-$PORT.pid" 2>/dev/null || true)"
if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then kill "$pid"; for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done; kill -0 "$pid" 2>/dev/null && kill -9 "$pid"; echo "stopped pid=$pid"; else echo "no server of ours on $PORT"; fi
rm -f "$RUN/server-$PORT.pid" "dist/server/e2e-entry-$PORT.mjs" "dist/server/e2e-clock-$PORT.mjs"
echo "evidence kept in ${VERIFY_EVIDENCE:-$RUN/evidence}"
