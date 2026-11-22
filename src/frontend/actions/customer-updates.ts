import { parseResponse, requestJson } from '@/frontend/actions/http';
import {
  CustomerUpdateAnalyticsResponseSchema,
  CustomerForecastResponseSchema,
  CustomerUpdateHistoryResponseSchema,
  CustomerUpdatesResponseSchema,
  type CustomerUpdateAnalytics,
  type CustomerForecast,
  type CustomerUpdateHistoryItem,
  type CustomerUpdatePeriod,
  type CustomerUpdateStatusFilter,
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

export async function listCustomerUpdateHistory(input: {
  page: number;
  limit: number;
  customerId?: string;
  from?: string;
  to?: string;
  status?: CustomerUpdateStatusFilter;
}): Promise<{ updates: CustomerUpdateHistoryItem[]; pagination: PaginationMeta | null }> {
  const params = new URLSearchParams({
    page: String(input.page),
    limit: String(input.limit),
    status: input.status ?? 'all',
  });
  if (input.customerId) params.set('customerId', input.customerId);
  if (input.from) params.set('from', input.from);
  if (input.to) params.set('to', input.to);

  const response = parseResponse(
    await requestJson(`/api/customer-updates/history?${params.toString()}`),
    CustomerUpdateHistoryResponseSchema,
    'Customer update history returned an invalid response.'
  );
  return {
    updates: response.data,
    pagination: response.meta?.pagination ?? null,
  };
}

export async function getCustomerUpdatesAnalytics(
  period: CustomerUpdatePeriod
): Promise<CustomerUpdateAnalytics> {
  const params = new URLSearchParams({ period });
  const response = parseResponse(
    await requestJson(`/api/customer-updates/analytics?${params.toString()}`),
    CustomerUpdateAnalyticsResponseSchema,
    'Customer update analytics returned an invalid response.'
  );
  return response.data;
}

export async function getCustomerAnalytics(
  customerId: string,
  period: CustomerUpdatePeriod
): Promise<CustomerUpdateAnalytics> {
  const params = new URLSearchParams({ period });
  const response = parseResponse(
    await requestJson(
      `/api/customers/${encodeURIComponent(customerId)}/analytics?${params.toString()}`
    ),
    CustomerUpdateAnalyticsResponseSchema,
    'Customer analytics returned an invalid response.'
  );
  return response.data;
}

export async function getCustomerForecast(customerId: string): Promise<CustomerForecast | null> {
  const response = parseResponse(
    await requestJson(`/api/customers/${encodeURIComponent(customerId)}/forecast`),
    CustomerForecastResponseSchema,
    'Customer forecast returned an invalid response.'
  );
  return response.data;
}
