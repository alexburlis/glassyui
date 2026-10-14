#!/usr/bin/env bash
set -euo pipefail

action="$1"
state="$2"

case "$action" in
  start)
    mkdir "$state"
    mkdir -p .next/standalone/public
    cp -R public/. .next/standalone/public/
    cp -R .next/static .next/standalone/.next/static
    HOSTNAME=127.0.0.1 PORT=3100 node .next/standalone/server.js > "$state/server.log" 2>&1 &
    echo "$!" > "$state/server.pid"
    for attempt in $(seq 1 60); do
      if curl --fail --silent http://127.0.0.1:3100/ > /dev/null; then
        exit 0
      fi
      if [ "$attempt" -eq 60 ]; then
        cat "$state/server.log"
        exit 1
      fi
      sleep 1
    done
    ;;
  stop)
    if [ ! -f "$state/server.pid" ]; then exit 0; fi
    server_pid="$(cat "$state/server.pid")"
    if kill -0 "$server_pid" 2>/dev/null; then
      kill "$server_pid"
      for _ in $(seq 1 30); do
        if ! kill -0 "$server_pid" 2>/dev/null; then break; fi
        sleep 0.1
      done
      if kill -0 "$server_pid" 2>/dev/null; then kill -KILL "$server_pid"; fi
    fi
    mkdir -p .artifacts
    cp "$state/server.log" .artifacts/ci-server.log
    rm "$state/server.pid" "$state/server.log"
    rmdir "$state"
    ;;
  *)
    echo "Expected start or stop and an owned server-state directory" >&2
    exit 1
    ;;
esac
