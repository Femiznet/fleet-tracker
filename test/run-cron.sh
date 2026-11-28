#!/usr/bin/env bash
set -u

CRON_SECRET="${CRON_SECRET:-cron-job}"
BASE_URL="http://localhost:3000"

trap 'echo "Stopping worker..."; exit 0' SIGINT SIGTERM

# Optional: Seed any new trucks once on startup
curl -s --max-time 30 -H "Authorization: Bearer $CRON_SECRET" "$BASE_URL/api/cron/seed-trucks"
echo ' -> seeded trucks'

while true; do
  curl -s --max-time 15 -H "Authorization: Bearer $CRON_SECRET" "$BASE_URL/api/cron/process-messages"
  echo ' -> processed messages'

  curl -s --max-time 20 -H "Authorization: Bearer $CRON_SECRET" "$BASE_URL/api/cron/sync-locations"
  echo ' -> synced locations'

  sleep 10
done
