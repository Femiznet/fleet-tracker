import { NextRequest } from 'next/server';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';
import { getPaginationMeta } from '@/backend/lib/pagination';
import { listCustomerUpdateHistory } from '@/backend/services/customer-updates/analytics';
import { parseCustomerUpdateHistoryQuery } from '@/backend/services/customer-updates/history-query';

export async function GET(request: NextRequest) {
  const filters = parseCustomerUpdateHistoryQuery(request.nextUrl.searchParams);
  if (!filters.success) {
    return apiError(
      { code: 'VALIDATION_ERROR', message: filters.message },
      400
    );
  }

  try {
    const result = await listCustomerUpdateHistory(filters.data);
    return apiSuccess(result.rows, {
      pagination: getPaginationMeta(filters.data.page, filters.data.limit, result.total),
    });
  } catch (error) {
    return apiDbError(error);
  }
}
