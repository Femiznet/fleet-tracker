import { NextRequest } from 'next/server';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';
import { getPagination, getPaginationMeta } from '@/backend/lib/pagination';
import { createDriver, listDrivers } from '@/backend/services/drivers/repository';
import { createDriverSchema } from '@/backend/services/schema/validators';

export async function GET(request: NextRequest) {
  try {
    const pagination = getPagination(request.nextUrl.searchParams);
    const search = request.nextUrl.searchParams.get('search')?.trim() || undefined;
    const result = await listDrivers(pagination.page, pagination.limit, search);
    return apiSuccess(result.rows, {
      pagination: getPaginationMeta(pagination.page, pagination.limit, result.total),
    });
  } catch (error) {
    return apiDbError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = createDriverSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Invalid driver data', details: parsed.error.flatten() }, 400);
    }
    return apiSuccess(await createDriver(parsed.data), { status: 201 });
  } catch (error) {
    return apiDbError(error);
  }
}
