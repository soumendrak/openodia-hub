#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PORT="${VERIFY_PORT:-9171}"
RUN="${VERIFY_DIR:-/tmp/verify-openodia-hub}"
ok=1
top="$(git rev-parse --show-toplevel)"
. "$HERE/owned.sh"
if pid="$(owned_pid "$RUN/server-$PORT.pid" "$PORT" "$top")"; then echo "process: ours pid=$pid (start time, root, command line and E2E_PORT match)"; else echo "process: pid file missing, stale or not our serve.mjs on $PORT"; ok=0; fi
owner="$(ss -ltnp 2>/dev/null | grep ":$PORT " | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)"
echo "port $PORT listener pid: ${owner:-none}"
clock="$(curl -fsS -m 10 "http://127.0.0.1:$PORT/__fixture-clock" 2>/dev/null || true)"
echo "fixture clock: ${clock:-unreachable}"
case "$clock" in *2026-10-12*) ;; *) ok=0 ;; esac
mode="$(cat "$RUN/server-$PORT.mode" 2>/dev/null || echo recorded)"
if [ "$mode" = outage ]; then want=503; else want=200; fi
code="$(curl -s -m 30 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/videos")"
echo "mode: $mode; /api/videos: $code (want $want)"
[ "$code" = "$want" ] || ok=0
dist_file="$RUN/app-$PORT/dist/server/index.js"
newer="$(cd "$top" && [ -e "$dist_file" ] && find src public package.json bun.lock vite.config.ts wrangler.jsonc tsconfig.json -type f -newer "$dist_file" -print -quit 2>/dev/null)"
head="$(cd "$top" && git log -1 --format=%ct)"
dist="$(stat -c %Y "$dist_file" 2>/dev/null || echo 0)"
echo "build: ${newer:+newer input $newer}${newer:-no input newer than dist} head commit=$head dist=$dist"
harness=ok
for d in db test/e2e; do diff -rq "$top/$d" "$RUN/app-$PORT/$d" >/dev/null 2>&1 || harness="$d differs from snapshot"; done
echo "harness: $harness"
{ [ -e "$dist_file" ] && [ -z "$newer" ] && [ "$dist" -ge "$head" ] && [ "$harness" = ok ]; } || { echo "snapshot dist missing or older than working-tree inputs: relaunch"; ok=0; }
[ "$ok" = 1 ] && echo "DOCTOR OK" || { echo "DOCTOR FAIL"; exit 1; }
