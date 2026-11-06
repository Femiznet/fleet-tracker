export const createPrompt = (message : string) => `
THE PROVIDED MESSAGE IS A COMPRESSED NATURAL GAS WHATSAPP UPDATE
Extract operational information from this CNG LOGISTICS WhatsApp message.

Return exactly one JSON object with this structure:

{
  "data": {
    "customer_name": null,
    "prms_count": 1,
    "prms_flows": [
      {
        "prms": "PRMS 1",
        "flow_rate": null
      }
    ],
    "flow_rate": null,
    "total_flow": null,
    "meter_reading_scm":null,
    "current_pressure_bar": null, // could be named skid pressure or just pressure, do not mistake it for the out or outlet pressure
    "empty_skids": null,
    "standby_skids": null,
    "skid_in_use_count": null,
    "skid_in_use_numbers": null,
    "available_trucks": null,
    "available_landing_gear_boxes": null
  },
  "needs_review": false,
  "review_reason": null
}

Rules:
- Default to one PRMS unless the message indicates otherwise.
- Each PRMS has one flow meter.
- Extract each PRMS flow separately.
- Identify multiple PRMS from explicit PRMS references or clearly identified separate flow readings.
- Do not assume multiple flow readings represent multiple PRMS without evidence.
- total_flow must be the sum of all valid PRMS flow readings.
- meter_reading_scm is the cumulative "Total Flow" / "Total" meter reading in scm (a large number such as 1336527.2). It is not a flow rate. Never put it in flow_rate or total_flow.
- flow_rate must contain the same cumulative value as total_flow.
- If any expected flow reading is ambiguous or missing, set total_flow and flow_rate to null and flag for review.
- Never interpret ambiguous values such as "0 100" by guessing.
- Use null for missing or unclear values.
- One message produces one object.
- Set needs_review to true for ambiguity, conflicting values, or multiple customers.
- A flow rate of 0 is valid when explicitly reported as zero.
- Do not treat 0 as missing.
- Values like "0 100" remain ambiguous; never guess whether they mean 0 or 100.
- skid IDs must be arrays of strings. For 2 (2560, 2507), return count 2 and IDs ["2560", "2507"].
- Return JSON only.

WhatsApp message:
${message}
`;