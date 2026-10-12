#!/usr/bin/env sh
# Starts the Buzzwire image, waits for the health check, then checks the API,
# the custom hook route, the SPA fallback and the API 404. Usage:
#   tests/smoke.sh <image>
set -eu

image="${1:?usage: tests/smoke.sh <image>}"
name="buzzwire-smoke-$$"

cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$name" -p 127.0.0.1::8090 "$image" >/dev/null
port="$(docker port "$name" 8090/tcp | head -n1 | sed 's/.*://')"
base="http://127.0.0.1:${port}"

printf 'Waiting for %s to become healthy' "$name"
i=0
until [ "$(docker inspect -f '{{.State.Health.Status}}' "$name")" = healthy ]; do
  i=$((i + 1))
  if [ "$i" -gt 30 ]; then
    echo; echo "Container never became healthy:"; docker logs "$name"; exit 1
  fi
  printf '.'; sleep 1
done
echo " ok"

fail=0
expect() { # expect <path> <status> <text in body>
  body="$(curl -s -w '\n%{http_code}' "${base}$1")"
  status="$(printf '%s' "$body" | tail -n1)"
  if [ "$status" = "$2" ] && printf '%s' "$body" | grep -q "$3"; then
    echo "  ok    $1 -> $status"
  else
    echo "  FAIL  $1 -> $status (wanted $2 containing '$3')"; fail=1
  fi
}

expect /api/health 200 "API is healthy"
expect /api/buzzwire/hello 200 "Hello from Buzzwire"
expect / 200 '<div id="root">'
expect /room/ABCD/board 200 '<div id="root">'
expect /api/does-not-exist 404 "Unknown API route"

exit "$fail"
