import { parseResponse, requestJson } from '@/frontend/actions/http';
import { PlantDashboardResponseSchema } from '@/frontend/types/plant-report';

export async function getPlantDashboard() {
  const response = parseResponse(
    await requestJson('/api/plant-reports?page=1&limit=1'),
    PlantDashboardResponseSchema,
    'The plant status returned an invalid response.'
  );
  return response.data;
}
