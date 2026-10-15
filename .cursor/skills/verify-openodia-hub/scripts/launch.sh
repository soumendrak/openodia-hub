#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
PORT="${VERIFY_PORT:-9171}"
RUN="${VERIFY_DIR:-/tmp/verify-openodia-hub}"
mkdir -p "$RUN" "${VERIFY_EVIDENCE:-$RUN/evidence}"
if ss -ltn | grep -q ":$PORT "; then echo "port $PORT is busy (not ours): set VERIFY_PORT"; exit 1; fi
if [ "${VERIFY_SKIP_BUILD:-0}" != "1" ]; then
  bun install --frozen-lockfile
  bun run build
fi
E2E_PORT="$PORT" nohup node test/e2e/serve.mjs >"$RUN/server-$PORT.log" 2>&1 &
echo $! >"$RUN/server-$PORT.pid"
for _ in $(seq 1 120); do
  if grep -q "Fixture Worker ready" "$RUN/server-$PORT.log"; then
    if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/api/videos"; then
      echo "ready http://127.0.0.1:$PORT pid=$(cat "$RUN/server-$PORT.pid")"
      exit 0
    fi
  fi
  if ! kill -0 "$(cat "$RUN/server-$PORT.pid")" 2>/dev/null; then cat "$RUN/server-$PORT.log"; exit 1; fi
  sleep 1
done
echo "not ready after 120s"; cat "$RUN/server-$PORT.log"; exit 1
