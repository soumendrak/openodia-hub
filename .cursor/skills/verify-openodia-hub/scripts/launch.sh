#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$(git rev-parse --show-toplevel)"
PORT="${VERIFY_PORT:-9171}"
RUN="${VERIFY_DIR:-/tmp/verify-openodia-hub}"
PIDFILE="$RUN/server-$PORT.pid"
NODE="$(command -v "${VERIFY_NODE:-node}")" || { echo "node not found: set VERIFY_NODE"; exit 1; }
[ "$("$NODE" -p 'process.versions.node.split(".")[0]')" -ge 22 ] || { echo "node 22+ required (README, CONTRIBUTING, CI e2e); $NODE is $("$NODE" -v): set VERIFY_NODE to a node 22+ binary"; exit 1; }
bun --version 2>/dev/null | awk -F. '{exit !($1 > 1 || ($1 == 1 && $2 >= 3))}' || { echo "bun 1.3+ required (CONTRIBUTING.md)"; exit 1; }
mkdir -p "$RUN" "${VERIFY_EVIDENCE:-$RUN/evidence}"
exec 7>"$RUN/port-$PORT.lock"
flock -n 7 || { echo "port $PORT is being launched by another run: set VERIFY_PORT"; exit 1; }
command -v ss >/dev/null || { echo "ss is required to check port $PORT before replacing run state"; exit 1; }
listeners="$(ss -ltnH "sport = :$PORT")" || { echo "port check for $PORT failed; refusing to replace run state"; exit 1; }
if [ -n "$listeners" ]; then echo "port $PORT is busy: set VERIFY_PORT"; exit 1; fi
rm -f "$PIDFILE"
SNAP="$RUN/app-$PORT"
exec 9>"$(git rev-parse --git-common-dir)/verify-openodia-hub.lock"
flock 9
if [ "${VERIFY_SKIP_BUILD:-0}" != "1" ]; then
  bun install --frozen-lockfile
  bun run build
  bash "$HERE/inputs.sh" >dist/.verify-inputs
elif ! bash "$HERE/inputs.sh" | cmp -s - dist/.verify-inputs; then
  echo "VERIFY_SKIP_BUILD=1 but dist/ was not built by launch.sh from the current inputs: rebuild without it"; exit 1
fi
rm -rf "$SNAP" && mkdir -p "$SNAP/test" && cp -rp dist db "$SNAP/" && cp -rp test/e2e "$SNAP/test/" && ln -s "$(pwd)/node_modules" "$SNAP/node_modules"
cp dist/.verify-inputs "$SNAP/.inputs"
flock -u 9
exec 9>&-
if [ "${E2E_UPSTREAM_FAILURE:-0}" = "1" ]; then PROBE="/__fixture-clock"; MODE=outage; else PROBE="/api/videos"; MODE=recorded; fi
echo "$MODE" >"$RUN/server-$PORT.mode"
(cd "$SNAP" && E2E_PORT="$PORT" exec nohup "$NODE" test/e2e/serve.mjs) >"$RUN/server-$PORT.log" 2>&1 7>&- &
pid=$!
printf '%s %s %s\n' "$pid" "$(awk '{print $22}' "/proc/$pid/stat")" "$(pwd)" >"$PIDFILE"
deadline=$((SECONDS + 120))
while [ "$SECONDS" -lt "$deadline" ]; do
  left=$((deadline - SECONDS))
  if grep -q "Fixture Worker ready" "$RUN/server-$PORT.log"; then
    if curl -fsS -m "$((left < 10 ? left : 10))" -o /dev/null "http://127.0.0.1:$PORT$PROBE"; then
      echo "ready http://127.0.0.1:$PORT pid=$pid probe=$PROBE"
      exit 0
    fi
  fi
  if ! kill -0 "$pid" 2>/dev/null; then cat "$RUN/server-$PORT.log"; exit 1; fi
  sleep 1
done
echo "not ready after 120s"; cat "$RUN/server-$PORT.log"; exit 1
