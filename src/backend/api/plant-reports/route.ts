import { NextRequest } from 'next/server';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '@/backend/db';
import { skids } from '@/backend/db/schema/skids';
import { plantSkidStatuses } from '@/backend/db/schema/plant-skid-status';
import { plantTruckStatuses } from '@/backend/db/schema/plant-truck-status';
import { trucks } from '@/backend/db/schema/trucks';
import { customers } from '@/backend/db/schema/customers';
import { plantReports, PlantReportMetrics } from '@/backend/db/schema/plant-report';
import {
  formatPlantReportMessage,
  getLivePlantFleetSnapshot,
  submitPlantStatus,
  SkidYardUpdate,
} from '@/backend/services/plant/report';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';
import { createPlantReportSchema } from '@/backend/services/schema/validators';

/**
 * GET /api/plant-reports
 * Loads everything the officer needs to render the hourly Plant Status form:
 * 1. Live fleet snapshot (trucks on ground, in transit, returning, etc.)
 * 2. Editable skids currently at GASTECH PLANT (for updating fill state and bay)
 * 3. Latest saved report's metrics (to pre-fill compressors, gearbox counts, officers, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    void request;
    const [fleetSnapshot, plantSkids, plantTrucks, latestReports] = await Promise.all([
      getLivePlantFleetSnapshot(),

      db
        .select({
          id: skids.id,
          skidNum: skids.skidNum,
          fillState: plantSkidStatuses.fillState,
          bay: plantSkidStatuses.bay,
          isOnMaintenance: plantSkidStatuses.isOnMaintenance,
          maintenanceNote: plantSkidStatuses.maintenanceNote,
          isNew: skids.isNew,
          owner: skids.owner,
          customerName: customers.name,
          note: plantSkidStatuses.note,
        })
        .from(skids)
        .leftJoin(customers, eq(skids.customerId, customers.id))
        .leftJoin(plantSkidStatuses, eq(plantSkidStatuses.skidId, skids.id))
        .where(
          and(eq(skids.status, 'available'), sql`TRIM(${skids.currentLoc}) = 'GASTECH PLANT'`)
        ),

      db
        .select({
          id: trucks.id,
          truckNum: trucks.truckNum,
          currentLoc: trucks.currentLoc,
          status: trucks.status,
          isStandby: plantTruckStatuses.isStandby,
          isOnMaintenance: plantTruckStatuses.isOnMaintenance,
          maintenanceNote: plantTruckStatuses.maintenanceNote,
          note: plantTruckStatuses.note,
        })
        .from(trucks)
        .leftJoin(plantTruckStatuses, eq(plantTruckStatuses.truckId, trucks.id))
        .where(
          and(
            sql`UPPER(TRIM(${trucks.group})) = 'GASTECH VEHICLES'`,
            sql`UPPER(TRIM(${trucks.currentLoc})) = 'GASTECH PLANT'`
          )
        ),

      db
        .select({
          id: plantReports.id,
          officersOnDuty: plantReports.officersOnDuty,
          metrics: plantReports.metrics,
          fleetSnapshot: plantReports.fleetSnapshot,
          notes: plantReports.notes,
          createdAt: plantReports.createdAt,
        })
        .from(plantReports)
        .orderBy(desc(plantReports.createdAt))
        .limit(1),
    ]);

    const latestReport = latestReports[0] ?? null;

    return apiSuccess({
      fleetSnapshot,
      plantSkids,
      plantTrucks,
      latestReport: latestReport
        ? {
            ...latestReport,
            formattedMessage: latestReport.fleetSnapshot
              ? formatPlantReportMessage(
                  latestReport.officersOnDuty,
                  latestReport.metrics,
                  latestReport.fleetSnapshot
                )
              : null,
          }
        : null,
    });
  } catch (error) {
    return apiDbError(error);
  }
}

/**
 * POST /api/plant-reports
 * Applies staged skid changes and returns the live plant-status snapshot and WhatsApp text.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = createPlantReportSchema.safeParse(await req.json());
    if (!parsed.success) {
      return apiError(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid plant report data',
          details: parsed.error.flatten(),
        },
        400
      );
    }

    const metrics = parsed.data.metrics as PlantReportMetrics;
    const skidUpdates = parsed.data.skidUpdates as SkidYardUpdate[];
    const { snapshot, formattedMessage, report } = await submitPlantStatus({
      officersOnDuty: parsed.data.officersOnDuty,
      metrics,
      skidUpdates,
      notes: parsed.data.notes,
    });

    return apiSuccess({ snapshot, formattedMessage, report }, { status: 201 });
  } catch (error) {
    return apiDbError(error);
  }
}
