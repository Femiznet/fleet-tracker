import {
  cancelMovement,
  movementsFeatureAvailable,
  movementsFeatureUnavailableResponse,
} from '@/generated/movements-feature';
import { apiValidationErrorResponse } from '@/lib/api-errors';
import { movementApiErrorResponse } from '@/lib/movement-api-errors';
import {
  cancelMovementRequestSchema,
  movementIdSchema,
} from '@/lib/validation/movements';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
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
  if (req.body === null) {
    body = {};
  } else {
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 },
      );
    }
  }

  const parsed = cancelMovementRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationErrorResponse(
      parsed.error,
      'Invalid cancellation request',
    );
  }

  try {
    await cancelMovement({
      movementId: parsedId.data,
      ...parsed.data,
    });

    return NextResponse.json({
      movementId: parsedId.data,
      status: 'cancelled',
    });
  } catch (error) {
    return movementApiErrorResponse(error, 'Failed to cancel movement');
  }
}
