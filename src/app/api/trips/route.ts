import { NextRequest } from 'next/server';
import { apiDbError, apiError, apiSuccess } from '@/lib/api-response';
import { getPagination, getPaginationMeta } from '@/lib/pagination';
import { createTrip, listTrips } from '@/services/trips/repository';
import { createTripSchema } from '@/services/schema/validators';

export async function GET(request: NextRequest) {
  try {
    const pagination = getPagination(request);
    const result = await listTrips(pagination.page, pagination.limit);
    return apiSuccess(result.rows, {
      pagination: getPaginationMeta(pagination.page, pagination.limit, result.total),
    });
  } catch (error) {
    return apiDbError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = createTripSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Invalid trip data', details: parsed.error.flatten() }, 400);
    }
    return apiSuccess(await createTrip(parsed.data), { status: 201 });
  } catch (error) {
    return apiDbError(error);
  }
}
