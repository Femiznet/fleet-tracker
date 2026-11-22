import { NextRequest } from 'next/server';
import { apiDbError, apiSuccess } from '@/backend/lib/api-response';
import { getPagination, getPaginationMeta } from '@/backend/lib/pagination';
import { listMovements } from '@/backend/services/movements/repository';

export async function GET(request: NextRequest) {
  const pagination = getPagination(request.nextUrl.searchParams);

  try {
    const result = await listMovements(pagination.page, pagination.limit);
    return apiSuccess(result.rows, {
      pagination: getPaginationMeta(pagination.page, pagination.limit, result.total),
    });
  } catch (error) {
    return apiDbError(error);
  }
}
