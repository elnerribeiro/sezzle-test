#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
compose=(docker compose --project-directory "$project_root" -f "$project_root/compose.yaml")

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Desktop or Docker Engine and try again." >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required. Install the Docker Compose plugin and try again." >&2
  exit 1
fi

usage() {
  echo "Usage: scripts/containers.sh {start|stop|status|logs}" >&2
}

case "${1:-}" in
  start)
    "${compose[@]}" up -d --build
    echo "Calculator is available at http://localhost:${CALCULATOR_WEB_PORT:-3000}"
    ;;
  stop)
    "${compose[@]}" stop web api
    ;;
  status)
    "${compose[@]}" ps
    ;;
  logs)
    "${compose[@]}" logs -f --tail=100
    ;;
  *)
    usage
    exit 2
    ;;
esac
