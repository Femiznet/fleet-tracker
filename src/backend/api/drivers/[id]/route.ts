import { NextRequest } from 'next/server';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';
import { deleteDriver, getDriverById, updateDriver } from '@/backend/services/drivers/repository';
import { updateDriverSchema } from '@/backend/services/schema/validators';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const driver = await getDriverById(id);
    return driver ? apiSuccess(driver) : apiError({ code: 'NOT_FOUND', message: 'Driver not found' }, 404);
  } catch (error) {
    return apiDbError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const parsed = updateDriverSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Invalid driver data', details: parsed.error.flatten() }, 400);
    }
    const { id } = await params;
    const driver = await updateDriver(id, parsed.data);
    return driver ? apiSuccess(driver) : apiError({ code: 'NOT_FOUND', message: 'Driver not found' }, 404);
  } catch (error) {
    return apiDbError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const driver = await deleteDriver(id);
    return driver ? apiSuccess(driver) : apiError({ code: 'NOT_FOUND', message: 'Driver not found' }, 404);
  } catch (error) {
    return apiDbError(error);
  }
}
