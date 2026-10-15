#!/usr/bin/env bash
set -uo pipefail
PORT="${VERIFY_PORT:-9171}"
RUN="${VERIFY_DIR:-/tmp/verify-openodia-hub}"
PIDFILE="$RUN/server-$PORT.pid"
cd "$(git rev-parse --show-toplevel)"
read -r pid start root <"$PIDFILE" 2>/dev/null || pid=""
ours=0
if [ -n "$pid" ] && [ -r "/proc/$pid/stat" ]; then
  if [ "$(awk '{print $22}' "/proc/$pid/stat")" = "$start" ] && [ "$root" = "$(pwd)" ] \
    && tr '\0' ' ' <"/proc/$pid/cmdline" | grep -q "test/e2e/serve.mjs" \
    && tr '\0' '\n' <"/proc/$pid/environ" 2>/dev/null | grep -qx "E2E_PORT=$PORT"; then ours=1; fi
fi
if [ "$ours" = 1 ]; then
  kill "$pid"
  for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
  kill -0 "$pid" 2>/dev/null && kill -9 "$pid"
  echo "stopped pid=$pid"
else
  echo "no server of ours on $PORT (pid file missing, stale, or another process): nothing killed"
fi
rm -f "$PIDFILE" "dist/server/e2e-entry-$PORT.mjs" "dist/server/e2e-clock-$PORT.mjs"
echo "evidence kept in ${VERIFY_EVIDENCE:-$RUN/evidence}"
