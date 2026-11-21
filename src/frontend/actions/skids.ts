import { z } from 'zod';
import { parseResponse, requestJson } from '@/frontend/actions/http';
import { PaginationMetaSchema } from '@/frontend/types/dispatch-review';
import { SkidSchema } from '@/frontend/types/skid';

const SkidListResponseSchema = z.object({
  data: z.array(SkidSchema),
  meta: z.object({ pagination: PaginationMetaSchema }).optional(),
});

export async function listDashboardSkids() {
  const response = parseResponse(
    await requestJson('/api/skids?page=1&limit=100'),
    SkidListResponseSchema,
    'The skid list returned an invalid response.'
  );
  return {
    skids: response.data,
    total: response.meta?.pagination.total ?? response.data.length,
  };
}
