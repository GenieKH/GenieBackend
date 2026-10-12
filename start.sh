#!/bin/sh
# Runs the whole backend in one container:
#   Redis (cache, rate limits, chat events between instances) -> authentication :4001, user :4002 -> api-gateway :4000
# Only the gateway port is meant to be published. If any process dies the
# container exits, so Docker's restart policy brings everything back up.

PIDS=""

start() {
  name=$1
  shift
  echo "[start] $name"
  "$@" &
  PIDS="$PIDS $!"
}

stop_all() {
  echo "[stop] shutting down..."
  # shellcheck disable=SC2086
  kill $PIDS 2>/dev/null
  wait
}
trap 'stop_all; exit 0' TERM INT

# --- Redis ---------------------------------------------------------------
# Use the embedded Redis unless REDIS_URL points at an external server.
case "${REDIS_URL:-}" in
  ""|*localhost*|*127.0.0.1*)
    export REDIS_URL="redis://127.0.0.1:6379"
    # Capped, and the least recently used keys go first: it shares this
    # container's memory with the services.
    start "redis" redis-server --bind 127.0.0.1 --port 6379 \
      --save "" --appendonly no --dir /tmp \
      --maxmemory 128mb --maxmemory-policy allkeys-lru
    i=0
    until redis-cli -h 127.0.0.1 ping >/dev/null 2>&1; do
      i=$((i + 1))
      if [ "$i" -gt 20 ]; then
        echo "[error] Redis did not start" >&2
        exit 1
      fi
      sleep 0.5
    done
    ;;
  *)
    echo "[start] using external Redis"
    ;;
esac

# --- Services ------------------------------------------------------------
# Ports and service URLs are fixed here so a PORT value in .env cannot make
# the three services fight over the same port.
export AUTH_SERVICE_URL="http://127.0.0.1:4001"
export USER_SERVICE_URL="http://127.0.0.1:4002"

PORT=4001 start "authentication" node authentication/dist/main.js
PORT=4002 start "user"           node user/dist/main.js
PORT=4000 start "api-gateway"    node api-gateway/dist/main.js

# Block until the first process exits, then take everything down.
wait -n
status=$?
echo "[error] a service exited (status $status); stopping the container." >&2
stop_all
exit 1
