import { NextRequest } from 'next/server';
import { apiDbError, apiError, apiSuccess } from '@/lib/api-response';
import { getPagination, getPaginationMeta } from '@/lib/pagination';
import { createTruck, listTrucks } from '@/services/trucks/repository';
import { createTruckSchema } from '@/services/schema/validators';

export async function GET(request: NextRequest) {
  try {
    const pagination = getPagination(request);
    const search = new URL(request.url).searchParams.get('search')?.trim() || undefined;
    const result = await listTrucks(pagination.page, pagination.limit, search);
    return apiSuccess(result.rows, {
      pagination: getPaginationMeta(pagination.page, pagination.limit, result.total),
    });
  } catch (error) {
    return apiDbError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = createTruckSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Invalid truck data', details: parsed.error.flatten() }, 400);
    }
    return apiSuccess(await createTruck(parsed.data), { status: 201 });
  } catch (error) {
    return apiDbError(error);
  }
}
