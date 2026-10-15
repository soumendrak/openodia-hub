#!/usr/bin/env bash
set -uo pipefail
PORT="${VERIFY_PORT:-9171}"
RUN="${VERIFY_DIR:-/tmp/verify-openodia-hub}"
ok=1
pid="$(cat "$RUN/server-$PORT.pid" 2>/dev/null || true)"
if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then echo "process: ours pid=$pid"; else echo "process: no server started by us on $PORT"; ok=0; fi
owner="$(ss -ltnp 2>/dev/null | grep ":$PORT " | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)"
echo "port $PORT listener pid: ${owner:-none}"
clock="$(curl -fsS "http://127.0.0.1:$PORT/__fixture-clock" 2>/dev/null || true)"
echo "fixture clock: ${clock:-unreachable}"
case "$clock" in *2026-10-12*) ;; *) ok=0 ;; esac
code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/videos")"
echo "/api/videos: $code"
[ "$code" = "200" ] || ok=0
dist="$(cd "$(git rev-parse --show-toplevel)" && stat -c %Y dist/server/index.js 2>/dev/null || echo 0)"
src="$(cd "$(git rev-parse --show-toplevel)" && git log -1 --format=%ct)"
echo "build mtime=$dist head commit=$src"
[ "$dist" -ge "$src" ] || { echo "dist older than HEAD: rebuild"; ok=0; }
[ "$ok" = 1 ] && echo "DOCTOR OK" || { echo "DOCTOR FAIL"; exit 1; }
