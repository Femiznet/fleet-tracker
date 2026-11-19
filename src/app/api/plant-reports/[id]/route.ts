import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { plantReports, PlantReportMetrics } from '@/db/schema/plant-report';
import { formatPlantReportMessage } from '@/services/plant/report';

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
      return NextResponse.json({ error: 'Plant report not found' }, { status: 404 });
    }

    const formattedMessage = report.fleetSnapshot
      ? formatPlantReportMessage(
          report.officersOnDuty,
          report.metrics,
          report.fleetSnapshot
        )
      : null;

    return NextResponse.json({ report, formattedMessage });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch plant report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/plant-reports/[id]
 * Edit an existing report's officers, metrics, or notes (preserves original frozen fleetSnapshot)
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const [existing] = await db
      .select()
      .from(plantReports)
      .where(eq(plantReports.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Plant report not found' }, { status: 404 });
    }

    const updatedOfficers =
      body.officersOnDuty !== undefined
        ? String(body.officersOnDuty).trim()
        : existing.officersOnDuty;

    if (!updatedOfficers) {
      return NextResponse.json(
        { error: 'Officers on duty cannot be empty' },
        { status: 400 }
      );
    }

    // Merge existing metrics with incoming changes so partial edits don't wipe other fields
    const updatedMetrics: PlantReportMetrics =
      body.metrics !== undefined
        ? { ...existing.metrics, ...body.metrics }
        : existing.metrics;

    const updatedNotes =
      body.notes !== undefined ? body.notes : existing.notes;

    const [updatedReport] = await db
      .update(plantReports)
      .set({
        officersOnDuty: updatedOfficers,
        metrics: updatedMetrics,
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

    return NextResponse.json({
      report: updatedReport,
      formattedMessage,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to update plant report';
    return NextResponse.json({ error: message }, { status: 500 });
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
      return NextResponse.json({ error: 'Plant report not found' }, { status: 404 });
    }

    return NextResponse.json({ deletedId: deleted.id, success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to delete plant report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
