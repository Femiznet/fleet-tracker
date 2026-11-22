import { parseResponse, requestJson } from '@/frontend/actions/http';
import { OfficerAlertsResponseSchema, type OfficerAlerts } from '@/frontend/types/officer-alert';

export async function getOfficerAlerts(): Promise<OfficerAlerts> {
  const response = parseResponse(
    await requestJson('/api/officer-alerts'),
    OfficerAlertsResponseSchema,
    'Officer alerts returned an invalid response.'
  );
  return response.data;
}
