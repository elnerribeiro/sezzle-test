#!/usr/bin/env bash
set -euo pipefail

api_pid=
web_pid=
api_binary=$(mktemp "${TMPDIR:-/tmp}/sezzle-calculator-api.XXXXXX")
cleanup() {
  if [[ -n "$web_pid" ]]; then kill "$web_pid" 2>/dev/null || true; wait "$web_pid" 2>/dev/null || true; fi
  if [[ -n "$api_pid" ]]; then kill "$api_pid" 2>/dev/null || true; wait "$api_pid" 2>/dev/null || true; fi
  rm -f "$api_binary"
}
trap cleanup EXIT INT TERM

go build -o "$api_binary" ../api/cmd/server
API_ADDRESS=127.0.0.1:8080 "$api_binary" &
api_pid=$!
./node_modules/.bin/vite --host 127.0.0.1 --strictPort &
web_pid=$!

ready=false
for _ in {1..80}; do
  if curl -fs http://127.0.0.1:8080/healthz >/dev/null 2>&1 && curl -fs http://127.0.0.1:5173/ >/dev/null 2>&1; then
    ready=true
    break
  fi
  if ! kill -0 "$api_pid" 2>/dev/null || ! kill -0 "$web_pid" 2>/dev/null; then break; fi
  sleep 0.25
done
if [[ "$ready" != true ]]; then
  echo "API and web server did not become ready."
  exit 1
fi

./node_modules/.bin/cucumber-js
