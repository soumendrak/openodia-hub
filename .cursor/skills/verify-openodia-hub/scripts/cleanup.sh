#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PORT="${VERIFY_PORT:-9171}"
RUN="${VERIFY_DIR:-/tmp/verify-openodia-hub}"
PIDFILE="$RUN/server-$PORT.pid"
cd "$(git rev-parse --show-toplevel)"
. "$HERE/owned.sh"
pid="$(owned_pid "$PIDFILE" "$PORT" "$(pwd)")" && ours=1 || ours=0
if [ "$ours" = 1 ]; then
  kill "$pid"
  for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
  kill -0 "$pid" 2>/dev/null && kill -9 "$pid"
  echo "stopped pid=$pid"
else
  echo "no server of ours on $PORT (pid file missing, stale, or another process): nothing killed"
fi
read -r old _ 2>/dev/null <"$PIDFILE" || old=""
if [ "$ours" = 1 ] || [ -z "$old" ] || ! kill -0 "$old" 2>/dev/null; then
  rm -rf "$PIDFILE" "$RUN/server-$PORT.mode" "$RUN/app-$PORT"
else
  echo "pid file names live pid=$old that is not ours: state left in place"
fi
echo "evidence kept in ${VERIFY_EVIDENCE:-$RUN/evidence}"
