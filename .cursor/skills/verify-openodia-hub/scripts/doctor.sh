#!/usr/bin/env bash
set -uo pipefail
PORT="${VERIFY_PORT:-9171}"
RUN="${VERIFY_DIR:-/tmp/verify-openodia-hub}"
ok=1
read -r pid _ _ <"$RUN/server-$PORT.pid" 2>/dev/null || pid=""
if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then echo "process: ours pid=$pid"; else echo "process: no server started by us on $PORT"; ok=0; fi
owner="$(ss -ltnp 2>/dev/null | grep ":$PORT " | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)"
echo "port $PORT listener pid: ${owner:-none}"
clock="$(curl -fsS "http://127.0.0.1:$PORT/__fixture-clock" 2>/dev/null || true)"
echo "fixture clock: ${clock:-unreachable}"
case "$clock" in *2026-10-12*) ;; *) ok=0 ;; esac
mode="$(cat "$RUN/server-$PORT.mode" 2>/dev/null || echo recorded)"
if [ "$mode" = outage ]; then want=503; else want=200; fi
code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/videos")"
echo "mode: $mode; /api/videos: $code (want $want)"
[ "$code" = "$want" ] || ok=0
top="$(git rev-parse --show-toplevel)"
dist="$(stat -c %Y "$top/dist/server/index.js" 2>/dev/null || echo 0)"
src="$(cd "$top" && find src public package.json bun.lock vite.config.ts wrangler.jsonc tsconfig.json -type f -printf '%T@\n' 2>/dev/null | sort -n | tail -1 | cut -d. -f1)"
head="$(cd "$top" && git log -1 --format=%ct)"
echo "build mtime=$dist newest input mtime=$src head commit=$head"
{ [ "$dist" -ge "$src" ] && [ "$dist" -ge "$head" ]; } || { echo "dist older than working-tree inputs: rebuild"; ok=0; }
[ "$ok" = 1 ] && echo "DOCTOR OK" || { echo "DOCTOR FAIL"; exit 1; }
