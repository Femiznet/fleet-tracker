#!/usr/bin/env bash
set -Eeuo pipefail

CRON_SECRET="${CRON_SECRET:-cron-job}"
BASE_URL="http://localhost:3000"

trap 'echo "Stopping worker..."; exit 0' SIGINT SIGTERM

# Optional: Seed any new trucks once on startup
curl -s --max-time 30 -H "Authorization: Bearer $CRON_SECRET" "$BASE_URL/api/cron/seed-trucks"
echo ' -> seeded trucks'

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"

if [[ -f "$repo_root/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$repo_root/.env.local"
  set +a
fi

seed_trucks=false
if [[ "${1:-}" == "--seed-trucks" ]]; then
  seed_trucks=true
  shift
fi

if (( $# > 0 )); then
  echo "Usage: $0 [--seed-trucks]" >&2
  exit 2
fi

: "${DATABASE_URL:?Set DATABASE_URL to a dedicated disposable test database}"

psql "$DATABASE_URL" \
  --set ON_ERROR_STOP=1 \
  --file "$script_dir/seed-customers.sql"

psql "$DATABASE_URL" \
  --set ON_ERROR_STOP=1 \
  --file "$script_dir/seed-skids.sql"

if [[ "$seed_trucks" == true ]]; then
  : "${CRON_SECRET:?Set CRON_SECRET to seed trucks}"
  : "${BASE_URL:?Set BASE_URL to the local app backed by DATABASE_URL}"

  curl \
    --fail-with-body \
    --silent \
    --show-error \
    --max-time 60 \
    --header "Authorization: Bearer ${CRON_SECRET}" \
    "${BASE_URL%/}/api/cron/seed-trucks"
  printf '\n'
fi
