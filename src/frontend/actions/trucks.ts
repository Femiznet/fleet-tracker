import { z } from 'zod';
import { parseResponse, requestJson } from '@/frontend/actions/http';
import { PaginationMetaSchema } from '@/frontend/types/dispatch-review';
import { TruckSchema } from '@/frontend/types/truck';

const TruckListResponseSchema = z.object({
  data: z.array(TruckSchema),
  meta: z.object({ pagination: PaginationMetaSchema }).optional(),
});

export async function listDashboardTrucks() {
  const response = parseResponse(
    await requestJson('/api/trucks?page=1&limit=100'),
    TruckListResponseSchema,
    'The truck list returned an invalid response.'
  );
  return {
    trucks: response.data,
    total: response.meta?.pagination.total ?? response.data.length,
  };
}
