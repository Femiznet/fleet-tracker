import { z } from 'zod';
import { parseResponse, requestJson } from '@/frontend/actions/http';
import { PaginationMetaSchema } from '@/frontend/types/dispatch-review';
import { SkidSchema } from '@/frontend/types/skid';

const SkidListResponseSchema = z.object({
  data: z.array(SkidSchema),
  meta: z.object({ pagination: PaginationMetaSchema }).optional(),
});

const SkidRegistrationResponseSchema = z.object({
  data: z.object({
    skids: z.array(SkidSchema),
    customerCreated: z.boolean(),
  }),
});

const SkidCustomerSearchResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      location: z.string().nullable(),
    })
  ),
});

export type SkidCustomerOption = z.infer<typeof SkidCustomerSearchResponseSchema>['data'][number];

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

export async function searchSkidCustomers(search: string): Promise<SkidCustomerOption[]> {
  const response = parseResponse(
    await requestJson(`/api/customers?page=1&limit=20&search=${encodeURIComponent(search)}`),
    SkidCustomerSearchResponseSchema,
    'Customer search returned an invalid response.'
  );
  return response.data;
}

export async function registerSkids(input: {
  skids: { skidNum: string; slugNum: string | null }[];
  owner: 'customer' | 'gastech';
  customerId?: string;
  customerName?: string;
  fillState?: 'empty' | 'loading' | 'loaded' | 'on_hold';
  bay?: 'washing_bay' | 'loading_bay' | 'parking_bay';
}) {
  const response = parseResponse(
    await requestJson('/api/skids/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
    SkidRegistrationResponseSchema,
    'Skid registration returned an invalid response.'
  );
  return response.data;
}
