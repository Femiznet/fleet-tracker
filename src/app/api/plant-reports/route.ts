import { NextRequest, NextResponse } from 'next/server';
import { desc, eq, and, sql } from 'drizzle-orm';
import { db } from '@/db';
import { skids } from '@/db/schema/skids';
import { customers } from '@/db/schema/customers';
import { plantReports, PlantReportMetrics } from '@/db/schema/plant-report';
import {
  getLivePlantFleetSnapshot,
  submitHourlyPlantReport,
  SkidYardUpdate,
} from '@/services/plant/report'; // adjust path to your service file

/**
 * GET /api/plant-reports
 * Loads everything the officer needs to render the hourly Plant Status form:
 * 1. Live fleet snapshot (trucks on ground, in transit, returning, etc.)
 * 2. Editable skids currently at GASTECH PLANT (for toggling fillState / bayState)
 * 3. Latest saved report's metrics (to pre-fill compressors, gearbox counts, officers, etc.)
 */
export async function GET() {
  try {
    const [fleetSnapshot, plantSkids, [latestReport]] = await Promise.all([
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
    ]);

    return NextResponse.json({
      fleetSnapshot,
      plantSkids,
      previousMetrics: latestReport?.metrics ?? null,
      previousOfficers: latestReport?.officersOnDuty ?? '',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load plant status data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/plant-reports
 * Submits the hourly yard updates + metrics, saves the report, and returns the WhatsApp text
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const officersOnDuty = String(body.officersOnDuty ?? '').trim();
    if (!officersOnDuty) {
      return NextResponse.json(
        { error: 'Officers on duty is required' },
        { status: 400 }
      );
    }

    const metrics: PlantReportMetrics = body.metrics ?? {};
    const skidUpdates: SkidYardUpdate[] = Array.isArray(body.skidUpdates)
      ? body.skidUpdates
      : [];
    const notes: string | undefined = body.notes;

    const { report, formattedMessage } = await submitHourlyPlantReport({
      officersOnDuty,
      metrics,
      skidUpdates,
      notes,
    });

    return NextResponse.json(
      {
        report,
        formattedMessage,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to submit plant report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
