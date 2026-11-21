import { NextRequest } from 'next/server';
import { apiDbError, apiSuccess } from '@/lib/api-response';
import { getPagination, getPaginationMeta } from '@/lib/pagination';
import { listMovements } from '@/services/movements/repository';

export async function GET(request: NextRequest) {
  try {
    const pagination = getPagination(request);
    const result = await listMovements(pagination.page, pagination.limit);
    return apiSuccess(result.rows, {
      pagination: getPaginationMeta(pagination.page, pagination.limit, result.total),
    });
  } catch (error) {
    return apiDbError(error);
  }
}
