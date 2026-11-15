while true; do
  curl -s -H "Authorization: Bearer cron-job" http://localhost:3000/api/cron/process-messages
  echo
  sleep 10
done