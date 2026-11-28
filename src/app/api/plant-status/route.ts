import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse, apiValidationErrorResponse } from '@/lib/api-errors';
import {
  getPlantStatusDashboard,
  plantStatusDateQuerySchema,
  plantStatusFeatureAvailable,
  plantStatusFeatureUnavailableResponse,
  updatePlantStatusReport,
  updatePlantStatusSchema,
} from '@/generated/plant-status-feature';

/**
 * GET /api/plant-status
 * Loads everything the officer needs to render the hourly Plant Status form.
 */
export async function GET(request: NextRequest) {
  if (!plantStatusFeatureAvailable) {
    return NextResponse.json(plantStatusFeatureUnavailableResponse, {
      status: 503,
    });
  }

  const query = plantStatusDateQuerySchema.safeParse({
    date: new URL(request.url).searchParams.get('date') ?? undefined,
  });
  if (!query.success) {
    return apiValidationErrorResponse(
      query.error,
      'Invalid plant status query',
    );
  }

  try {
    const dashboard = await getPlantStatusDashboard(query.data.date);
    return NextResponse.json(dashboard);
  } catch (error) {
    return apiErrorResponse(error, 'Failed to load plant status data');
  }
}

/**
 * POST /api/plant-status
 * Updates the current plant status and returns the live WhatsApp text.
 */
export async function POST(req: NextRequest) {
  if (!plantStatusFeatureAvailable) {
    return NextResponse.json(plantStatusFeatureUnavailableResponse, {
      status: 503,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON' },
      { status: 400 },
    );
  }

  const parsed = updatePlantStatusSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationErrorResponse(
      parsed.error,
      'Invalid plant status update',
    );
  }

  try {
    const result = await updatePlantStatusReport(parsed.data);
    console.log(result.formattedMessage);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to update plant status');
  }
}
