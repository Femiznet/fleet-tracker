import { NextRequest } from 'next/server';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';
import { getPagination, getPaginationMeta } from '@/backend/lib/pagination';
import { createTrip, listTrips } from '@/backend/services/trips/repository';
import { createTripSchema } from '@/backend/services/schema/validators';

export async function GET(request: NextRequest) {
  try {
    const pagination = getPagination(request.nextUrl.searchParams);
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
