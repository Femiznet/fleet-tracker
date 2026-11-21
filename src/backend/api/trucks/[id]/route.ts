import { NextRequest } from 'next/server';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';
import { deleteTruck, getTruckById, updateTruck } from '@/backend/services/trucks/repository';
import { updateTruckSchema } from '@/backend/services/schema/validators';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const truck = await getTruckById(id);
    return truck
      ? apiSuccess(truck)
      : apiError({ code: 'NOT_FOUND', message: 'Truck not found' }, 404);
  } catch (error) {
    return apiDbError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const parsed = updateTruckSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Invalid truck data', details: parsed.error.flatten() }, 400);
    }
    const { id } = await params;
    const truck = await updateTruck(id, parsed.data);
    return truck
      ? apiSuccess(truck)
      : apiError({ code: 'NOT_FOUND', message: 'Truck not found' }, 404);
  } catch (error) {
    return apiDbError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const truck = await deleteTruck(id);
    return truck
      ? apiSuccess(truck)
      : apiError({ code: 'NOT_FOUND', message: 'Truck not found' }, 404);
  } catch (error) {
    return apiDbError(error);
  }
}
