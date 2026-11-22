import { NextRequest } from 'next/server';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';
import { deleteSkid, getSkidById, updateSkid } from '@/backend/services/skids/repository';
import { updateSkidSchema } from '@/backend/services/schema/validators';
import { updatePlantSkidStatusSchema } from '@/backend/services/schema/validators';
import { db } from '@/backend/db';
import { plantSkidStatuses } from '@/backend/db/schema/plant-skid-status';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const skid = await getSkidById(id);
    return skid
      ? apiSuccess(skid)
      : apiError({ code: 'NOT_FOUND', message: 'Skid not found' }, 404);
  } catch (error) {
    return apiDbError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const body = await request.json();
    const { id } = await params;
    const statusParsed = updatePlantSkidStatusSchema.safeParse(body);
    if (!statusParsed.success) {
      const parsed = updateSkidSchema.safeParse(body);
      if (!parsed.success) {
        return apiError(
          {
            code: 'VALIDATION_ERROR',
            message: 'Invalid skid data',
            details: parsed.error.flatten(),
          },
          400
        );
      }
      if (parsed.data.currentLoc !== undefined) {
        const existingSkid = await getSkidById(id);
        if (!existingSkid) {
          return apiError({ code: 'NOT_FOUND', message: 'Skid not found' }, 404);
        }
        if (
          (existingSkid.owner === 'customer' || existingSkid.customerId) &&
          parsed.data.currentLoc !== 'pending'
        ) {
          return apiError(
            {
              code: 'CUSTOMER_SKID_LOCATION_UNTRACKED',
              message: 'Customer skid locations are not tracked and must remain pending.',
            },
            400
          );
        }
      }
      const skid = await updateSkid(id, parsed.data);
      return skid
        ? apiSuccess(skid)
        : apiError({ code: 'NOT_FOUND', message: 'Skid not found' }, 404);
    }

    const existingSkid = await getSkidById(id);
    if (!existingSkid) {
      return apiError({ code: 'NOT_FOUND', message: 'Skid not found' }, 404);
    }
    if (
      (existingSkid.owner === 'customer' || existingSkid.customerId) &&
      (statusParsed.data.isOnMaintenance === true ||
        Boolean(statusParsed.data.maintenanceNote?.trim()))
    ) {
      return apiError(
        {
          code: 'CUSTOMER_SKID_MAINTENANCE_UNSUPPORTED',
          message: 'Maintenance tracking is only available for Gastech-owned skids.',
        },
        400
      );
    }

    const [status] = await db
      .insert(plantSkidStatuses)
      .values({
        skidId: id,
        fillState: statusParsed.data.fillState,
        bay: statusParsed.data.fillState === 'loading' ? 'loading_bay' : statusParsed.data.bay,
        note: statusParsed.data.note?.trim() || null,
        isOnMaintenance:
          existingSkid.owner === 'customer' || existingSkid.customerId
            ? false
            : statusParsed.data.isOnMaintenance,
        maintenanceNote:
          existingSkid.owner === 'customer' || existingSkid.customerId
            ? null
            : statusParsed.data.maintenanceNote?.trim() || null,
      })
      .onConflictDoUpdate({
        target: plantSkidStatuses.skidId,
        set: {
          fillState: statusParsed.data.fillState,
          bay: statusParsed.data.fillState === 'loading' ? 'loading_bay' : statusParsed.data.bay,
          note: statusParsed.data.note?.trim() || null,
          ...(existingSkid.owner === 'customer' || existingSkid.customerId
            ? { isOnMaintenance: false, maintenanceNote: null }
            : {
                ...(statusParsed.data.isOnMaintenance !== undefined && {
                  isOnMaintenance: statusParsed.data.isOnMaintenance,
                }),
                ...(statusParsed.data.maintenanceNote !== undefined && {
                  maintenanceNote: statusParsed.data.maintenanceNote?.trim() || null,
                }),
              }),
          updatedAt: new Date(),
        },
      })
      .returning();

    const skid = await getSkidById(id);
    return skid && status
      ? apiSuccess({ skid, status })
      : apiError({ code: 'NOT_FOUND', message: 'Skid not found' }, 404);
  } catch (error) {
    return apiDbError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const skid = await deleteSkid(id);
    return skid
      ? apiSuccess(skid)
      : apiError({ code: 'NOT_FOUND', message: 'Skid not found' }, 404);
  } catch (error) {
    return apiDbError(error);
  }
}
