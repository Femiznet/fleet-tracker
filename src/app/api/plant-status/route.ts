import { NextRequest, NextResponse } from 'next/server';
import {
  apiErrorResponse,
  apiValidationErrorResponse,
} from '@/lib/api-errors';
import { eq, and, isNull, sql, desc } from 'drizzle-orm';
import { db } from '@/db';
import { skids } from '@/db/schema/skids';
import { customers } from '@/db/schema/customers';
import { customerSkidLoadings } from '@/db/schema/customer-skid-loading';
import {
  getLivePlantFleetSnapshot,
  getCurrentPlantStatus,
  getDailyDispatchSummary,
  updateCurrentPlantStatus,
} from '@/services/plant';
import {
  plantStatusDateQuerySchema,
  updatePlantStatusSchema,
} from '@/services/plant/validator';

/**
 * GET /api/plant-status
 * Loads everything the officer needs to render the hourly Plant Status form:
 * 1. Live fleet snapshot (trucks on ground, in transit, returning, etc.)
 * 2. Editable skids currently at GASTECH PLANT
 * 3. Current editable plant status and today's dispatch totals
 */
export async function GET(request: NextRequest) {
  try {
    const query = plantStatusDateQuerySchema.safeParse({
      date: new URL(request.url).searchParams.get('date') ?? undefined,
    });
    if (!query.success) {
      return apiValidationErrorResponse(query.error, 'Invalid plant status query');
    }
    const requestedDate = query.data.date;

    const [
      fleetSnapshot,
      plantSkids,
      currentCustomerLoadings,
      currentStatus,
      dailyDispatchSummary,
    ] = await Promise.all([
      getLivePlantFleetSnapshot(),

      db
        .select({
          id: skids.id,
          skidNum: skids.skidNum,
          state: skids.state,
          isForWashing: skids.isForWashing,
          isNew: skids.isNew,
          customerName: customers.name,
        })
        .from(skids)
        .leftJoin(customers, eq(skids.customerId, customers.id))
        .where(
          and(
            eq(skids.status, 'available'),
            isNull(skids.customerId),
            sql`TRIM(${skids.currentLoc}) = 'GASTECH PLANT'`
          )
        ),

      db
        .select({
          id: customerSkidLoadings.id,
          customerId: customerSkidLoadings.customerId,
          customerName: customers.name,
          skidNum: customerSkidLoadings.skidNum,
          state: customerSkidLoadings.state,
          isForWashing: customerSkidLoadings.isForWashing,
          arrivedAt: customerSkidLoadings.arrivedAt,
          loadedAt: customerSkidLoadings.loadedAt,
        })
        .from(customerSkidLoadings)
        .innerJoin(customers, eq(customerSkidLoadings.customerId, customers.id))
        .where(isNull(customerSkidLoadings.dispatchedAt))
        .orderBy(desc(customerSkidLoadings.arrivedAt)),

      getCurrentPlantStatus(),
      getDailyDispatchSummary(requestedDate ?? undefined),
    ]);

    return NextResponse.json({
      fleetSnapshot,
      plantSkids,
      customerSkidLoadings: currentCustomerLoadings,
      plantStatus: currentStatus,
      dailyDispatchSummary,
      previousMetrics: currentStatus?.metrics ?? null,
      previousOfficers: currentStatus?.officersOnDuty ?? '',
    });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to load plant status data');
  }
}

/**
 * POST /api/plant-status
 * Updates the current plant status and returns the live WhatsApp text.
 */
export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Request body must be valid JSON' },
        { status: 400 }
      );
    }

    const parsed = updatePlantStatusSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationErrorResponse(parsed.error, 'Invalid plant status update');
    }

    const { plantStatus, fleetSnapshot, formattedMessage } =
      await updateCurrentPlantStatus(parsed.data);
    const dailyDispatchSummary = await getDailyDispatchSummary();

    return NextResponse.json(
      {
        plantStatus,
        fleetSnapshot,
        dailyDispatchSummary,
        formattedMessage,
      },
      { status: 200 }
    );
  } catch (error) {
    return apiErrorResponse(error, 'Failed to update plant status');
  }
}
