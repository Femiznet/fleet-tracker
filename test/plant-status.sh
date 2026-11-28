#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000/api/plant-status}"

echo "=== 1. GET /api/plant-status (Fetch live snapshot & previous metrics) ==="
GET_RES=$(curl -sS -w "\n%{http_code}" "$BASE_URL")
GET_CODE=$(echo "$GET_RES" | tail -n1)
GET_BODY=$(echo "$GET_RES" | sed '$d')
echo "Status: $GET_CODE"
echo "$GET_BODY" | head -c 300
echo -e "\n"

echo "=== 2. POST /api/plant-status (Create hourly report) ==="
POST_RES=$(curl -sS -w "\n%{http_code}" -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "officersOnDuty": "ADEYEMI/MAYOWA/EMMANUEL",
    "metrics": {
      "inletPressureBar": 13.1,
      "loadingPressureBar": 190,
      "landingGearBox": {
        "loadingAndWashingBay": 52,
        "workshop": 29,
        "wooden": 2
      },
      "newChassisInPlant": 12,
      "compressors": {
        "COMP 1": "On",
        "COMP 2": "On",
        "COMP 3": "On (NGV)"
      }
    },
    "skidUpdates": [],
    "notes": "API automated test"
  }')

POST_CODE=$(echo "$POST_RES" | tail -n1)
POST_BODY=$(echo "$POST_RES" | sed '$d')
echo "Status: $POST_CODE"

# Extract created report ID using node (built-in)
REPORT_ID=$(node -e 'const data = JSON.parse(process.argv[1]); console.log(data.report?.id ?? "");' "$POST_BODY")
echo "Created Report ID: $REPORT_ID"

if [ -z "$REPORT_ID" ]; then
  echo "Failed to extract report ID. Response:"
  echo "$POST_BODY"
  exit 1
fi

echo "--- Formatted WhatsApp Preview ---"
node -e 'const data = JSON.parse(process.argv[1]); console.log(data.formattedMessage);' "$POST_BODY"
echo -e "----------------------------------\n"

echo "=== 3. GET /api/plant-status/$REPORT_ID (Fetch single report) ==="
curl -sS -o /dev/null -w "Status: %{http_code}\n\n" "$BASE_URL/$REPORT_ID"

echo "=== 4. PATCH /api/plant-status/$REPORT_ID (Edit inletPressureBar) ==="
PATCH_RES=$(curl -sS -w "\n%{http_code}" -X PATCH "$BASE_URL/$REPORT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": {
      "inletPressureBar": 14.5
    },
    "notes": "Updated inlet pressure after check"
  }')
PATCH_CODE=$(echo "$PATCH_RES" | tail -n1)
PATCH_BODY=$(echo "$PATCH_RES" | sed '$d')
echo "Status: $PATCH_CODE"
node -e 'const data = JSON.parse(process.argv[1]); console.log("Updated Inlet Pressure:", data.report?.metrics?.inletPressureBar);' "$PATCH_BODY"
echo ""

echo "=== 5. DELETE /api/plant-status/$REPORT_ID (Clean up test record) ==="
DEL_RES=$(curl -sS -w "\n%{http_code}" -X DELETE "$BASE_URL/$REPORT_ID")
DEL_CODE=$(echo "$DEL_RES" | tail -n1)
DEL_BODY=$(echo "$DEL_RES" | sed '$d')
echo "Status: $DEL_CODE"
echo "Response: $DEL_BODY"
