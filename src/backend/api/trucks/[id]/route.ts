import { NextRequest } from 'next/server';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';
import { deleteTruck, getTruckById, updateTruck } from '@/backend/services/trucks/repository';
import { updateTruckSchema } from '@/backend/services/schema/validators';
import { updatePlantTruckStatusSchema } from '@/backend/services/schema/validators';
import { db } from '@/backend/db';
import { plantTruckStatuses } from '@/backend/db/schema/plant-truck-status';

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
    const body = await request.json();
    const { id } = await params;
    const statusParsed = updatePlantTruckStatusSchema.safeParse(body);
    if (statusParsed.success && Object.keys(statusParsed.data).length) {
      await db
        .insert(plantTruckStatuses)
        .values({
          truckId: id,
          isStandby: statusParsed.data.isStandby ?? false,
          isOnMaintenance: statusParsed.data.isOnMaintenance ?? false,
          maintenanceNote: statusParsed.data.maintenanceNote?.trim() || null,
          note: statusParsed.data.note?.trim() || null,
        })
        .onConflictDoUpdate({
          target: plantTruckStatuses.truckId,
          set: {
            ...(statusParsed.data.isStandby !== undefined && { isStandby: statusParsed.data.isStandby }),
            ...(statusParsed.data.isOnMaintenance !== undefined && { isOnMaintenance: statusParsed.data.isOnMaintenance }),
            ...(statusParsed.data.maintenanceNote !== undefined && { maintenanceNote: statusParsed.data.maintenanceNote?.trim() || null }),
            ...(statusParsed.data.note !== undefined && { note: statusParsed.data.note?.trim() || null }),
            updatedAt: new Date(),
          },
        });
    }

    const parsed = updateTruckSchema.safeParse(body);
    if (!parsed.success && !statusParsed.success) {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Invalid truck data', details: parsed.error.flatten() }, 400);
    }
    if (statusParsed.success && Object.keys(statusParsed.data).length) {
      const truck = await getTruckById(id);
      return truck ? apiSuccess(truck) : apiError({ code: 'NOT_FOUND', message: 'Truck not found' }, 404);
    }
    if (!parsed.success) {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Invalid truck data', details: parsed.error.flatten() }, 400);
    }
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
