import { NextRequest } from 'next/server';
import { count, desc, eq, and, sql } from 'drizzle-orm';
import { db } from '@/db';
import { skids } from '@/db/schema/skids';
import { customers } from '@/db/schema/customers';
import { plantReports, PlantReportMetrics } from '@/db/schema/plant-report';
import {
  getLivePlantFleetSnapshot,
  submitHourlyPlantReport,
  SkidYardUpdate,
} from '@/services/plant/report'; // adjust path to your service file
import { apiDbError, apiError, apiSuccess } from '@/lib/api-response';
import { getPagination, getPaginationMeta } from '@/lib/pagination';
import { createPlantReportSchema } from '@/services/schema/validators';

/**
 * GET /api/plant-reports
 * Loads everything the officer needs to render the hourly Plant Status form:
 * 1. Live fleet snapshot (trucks on ground, in transit, returning, etc.)
 * 2. Editable skids currently at GASTECH PLANT (for toggling fillState / bayState)
 * 3. Latest saved report's metrics (to pre-fill compressors, gearbox counts, officers, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const pagination = getPagination(request);
    const [fleetSnapshot, plantSkids, [latestReport], reportsResult] = await Promise.all([
      getLivePlantFleetSnapshot(),

      // Fetch editable skids at GASTECH PLANT so the officer can toggle fillState / bayState
      db
        .select({
          id: skids.id,
          skidNum: skids.skidNum,
          fillState: skids.fillState,
          bayState: skids.bayState,
          isNew: skids.isNew,
          customerName: customers.name,
        })
        .from(skids)
        .leftJoin(customers, eq(skids.customerId, customers.id))
        .where(
          and(
            eq(skids.status, 'available'),
            sql`TRIM(${skids.currentLoc}) = 'GASTECH PLANT'`
          )
        ),

      // Fetch the most recent report to pre-fill recurring shift metrics
      db
        .select()
        .from(plantReports)
        .orderBy(desc(plantReports.createdAt))
        .limit(1),
      db
        .select()
        .from(plantReports)
        .orderBy(desc(plantReports.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
    ]);

    const [totalRows] = await db
      .select({ value: count() })
      .from(plantReports);
    const reports = reportsResult;

    return apiSuccess({
      fleetSnapshot,
      plantSkids,
      previousMetrics: latestReport?.metrics ?? null,
      previousOfficers: latestReport?.officersOnDuty ?? '',
      reports,
    }, {
      pagination: getPaginationMeta(pagination.page, pagination.limit, Number(totalRows?.value ?? 0)),
    });
  } catch (error) {
    return apiDbError(error);
  }
}

/**
 * POST /api/plant-reports
 * Submits the hourly yard updates + metrics, saves the report, and returns the WhatsApp text
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = createPlantReportSchema.safeParse(await req.json());
    if (!parsed.success) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Invalid plant report data',
        details: parsed.error.flatten(),
      }, 400);
    }

    const metrics = parsed.data.metrics as PlantReportMetrics;
    const skidUpdates = parsed.data.skidUpdates as SkidYardUpdate[];
    const notes = parsed.data.notes ?? undefined;

    const { report, formattedMessage } = await submitHourlyPlantReport({
      officersOnDuty: parsed.data.officersOnDuty,
      metrics,
      skidUpdates,
      notes,
    });

    return apiSuccess({ report, formattedMessage }, { status: 201 });
  } catch (error) {
    return apiDbError(error);
  }
}
