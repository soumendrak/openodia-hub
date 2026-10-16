owned_pid() {
  local pidfile="$1" port="$2" root="$3" pid start rroot
  read -r pid start rroot 2>/dev/null <"$pidfile" || return 1
  [ -n "$pid" ] && [ -r "/proc/$pid/stat" ] || return 1
  [ "$(awk '{print $22}' "/proc/$pid/stat")" = "$start" ] || return 1
  [ "$rroot" = "$root" ] || return 1
  tr '\0' ' ' <"/proc/$pid/cmdline" | grep -q "test/e2e/serve.mjs" || return 1
  tr '\0' '\n' <"/proc/$pid/environ" 2>/dev/null | grep -qx "E2E_PORT=$port" || return 1
  echo "$pid"
}
