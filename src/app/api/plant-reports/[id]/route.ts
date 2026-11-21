import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { plantReports, PlantReportMetrics } from '@/db/schema/plant-report';
import { formatPlantReportMessage } from '@/services/plant/report';
import { apiDbError, apiError, apiSuccess } from '@/lib/api-response';
import { updatePlantReportSchema } from '@/services/schema/validators';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/plant-reports/[id]
 * Fetch a single saved report + its formatted WhatsApp message
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const [report] = await db
      .select()
      .from(plantReports)
      .where(eq(plantReports.id, id))
      .limit(1);

    if (!report) {
      return apiError({ code: 'NOT_FOUND', message: 'Plant report not found' }, 404);
    }

    const formattedMessage = report.fleetSnapshot
      ? formatPlantReportMessage(
          report.officersOnDuty,
          report.metrics,
          report.fleetSnapshot
        )
      : null;

    return apiSuccess({ report, formattedMessage });
  } catch (error) {
    return apiDbError(error);
  }
}

/**
 * PATCH /api/plant-reports/[id]
 * Edit an existing report's officers, metrics, or notes (preserves original frozen fleetSnapshot)
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parsed = updatePlantReportSchema.safeParse(await req.json());
    if (!parsed.success) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Invalid plant report data',
        details: parsed.error.flatten(),
      }, 400);
    }

    const [existing] = await db
      .select()
      .from(plantReports)
      .where(eq(plantReports.id, id))
      .limit(1);

    if (!existing) {
      return apiError({ code: 'NOT_FOUND', message: 'Plant report not found' }, 404);
    }

    const updatedOfficers =
      parsed.data.officersOnDuty !== undefined
        ? parsed.data.officersOnDuty
        : existing.officersOnDuty;

    if (!updatedOfficers) {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Officers on duty cannot be empty' }, 400);
    }

    // Merge existing metrics with incoming changes so partial edits don't wipe other fields
    const updatedMetrics: PlantReportMetrics =
      parsed.data.metrics !== undefined
        ? { ...existing.metrics, ...parsed.data.metrics }
        : existing.metrics;
    const typedMetrics = updatedMetrics as PlantReportMetrics;

    const updatedNotes =
      parsed.data.notes !== undefined ? parsed.data.notes : existing.notes;

    const [updatedReport] = await db
      .update(plantReports)
      .set({
        officersOnDuty: updatedOfficers,
        metrics: typedMetrics,
        notes: updatedNotes,
      })
      .where(eq(plantReports.id, id))
      .returning();

    const formattedMessage = updatedReport.fleetSnapshot
      ? formatPlantReportMessage(
          updatedReport.officersOnDuty,
          updatedReport.metrics,
          updatedReport.fleetSnapshot
        )
      : null;

    return apiSuccess({ report: updatedReport, formattedMessage });
  } catch (error) {
    return apiDbError(error);
  }
}

/**
 * DELETE /api/plant-reports/[id]
 * Delete a mistaken or duplicate plant report
 */
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const [deleted] = await db
      .delete(plantReports)
      .where(eq(plantReports.id, id))
      .returning({ id: plantReports.id });

    if (!deleted) {
      return apiError({ code: 'NOT_FOUND', message: 'Plant report not found' }, 404);
    }

    return apiSuccess({ deletedId: deleted.id });
  } catch (error) {
    return apiDbError(error);
  }
}
