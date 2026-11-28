import {
  movementsFeatureAvailable,
  movementsFeatureUnavailableResponse,
  switchDispatchTrackingMode,
} from '@/generated/movements-feature';
import { apiValidationErrorResponse } from '@/lib/api-errors';
import { movementApiErrorResponse } from '@/lib/movement-api-errors';
import {
  movementIdSchema,
  trackingModeRequestSchema,
} from '@/lib/validation/movements';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  if (!movementsFeatureAvailable) {
    return NextResponse.json(movementsFeatureUnavailableResponse, {
      status: 503,
    });
  }

  const { id } = await context.params;
  const parsedId = movementIdSchema.safeParse(id);
  if (!parsedId.success) {
    return apiValidationErrorResponse(parsedId.error, 'Invalid movement ID');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid or empty JSON request body' },
      { status: 400 },
    );
  }

  const parsed = trackingModeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationErrorResponse(parsed.error, 'Invalid tracking mode');
  }

  try {
    await switchDispatchTrackingMode({
      movementId: parsedId.data,
      trackingMode: parsed.data.trackingMode,
    });

    return NextResponse.json({
      movementId: parsedId.data,
      trackingMode: parsed.data.trackingMode,
    });
  } catch (error) {
    return movementApiErrorResponse(
      error,
      'Failed to switch dispatch tracking mode',
    );
  }
}
