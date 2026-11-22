import { parseResponse, requestJson } from '@/frontend/actions/http';
import {
  CustomerForecastResponseSchema,
  CustomerUpdatesResponseSchema,
  type CustomerForecast,
  type CustomerUpdateMessage,
} from '@/frontend/types/customer-update';
import type { PaginationMeta } from '@/frontend/types/dispatch-review';

export async function listCustomerUpdates(input: {
  page: number;
  limit: number;
}): Promise<{ updates: CustomerUpdateMessage[]; pagination: PaginationMeta | null }> {
  const params = new URLSearchParams({
    type: 'update',
    page: String(input.page),
    limit: String(input.limit),
  });
  const response = parseResponse(
    await requestJson(`/api/messages?${params.toString()}`),
    CustomerUpdatesResponseSchema,
    'Customer updates returned an invalid response.'
  );
  return {
    updates: response.data,
    pagination: response.meta?.pagination ?? null,
  };
}

export async function getCustomerForecast(customerId: string): Promise<CustomerForecast | null> {
  const response = parseResponse(
    await requestJson(`/api/customers/${encodeURIComponent(customerId)}/forecast`),
    CustomerForecastResponseSchema,
    'Customer forecast returned an invalid response.'
  );
  return response.data;
}
