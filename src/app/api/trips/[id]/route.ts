import { NextRequest } from 'next/server';
import { apiDbError, apiError, apiSuccess } from '@/lib/api-response';
import { deleteTrip, getTripById, updateTrip } from '@/services/trips/repository';
import { updateTripSchema } from '@/services/schema/validators';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const trip = await getTripById(id);
    return trip ? apiSuccess(trip) : apiError({ code: 'NOT_FOUND', message: 'Trip not found' }, 404);
  } catch (error) {
    return apiDbError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const parsed = updateTripSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Invalid trip data', details: parsed.error.flatten() }, 400);
    }
    const { id } = await params;
    const trip = await updateTrip(id, parsed.data);
    return trip ? apiSuccess(trip) : apiError({ code: 'NOT_FOUND', message: 'Trip not found' }, 404);
  } catch (error) {
    return apiDbError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const trip = await deleteTrip(id);
    return trip ? apiSuccess(trip) : apiError({ code: 'NOT_FOUND', message: 'Trip not found' }, 404);
  } catch (error) {
    return apiDbError(error);
  }
}
