import {
  completeMovement,
  movementsFeatureAvailable,
  movementsFeatureUnavailableResponse,
} from '@/generated/movements-feature';
import { apiValidationErrorResponse } from '@/lib/api-errors';
import { movementApiErrorResponse } from '@/lib/movement-api-errors';
import {
  completeMovementRequestSchema,
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
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid or empty JSON request body' },
      { status: 400 },
    );
  }

  const parsed = completeMovementRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationErrorResponse(
      parsed.error,
      'Invalid completion request',
    );
  }

  try {
    await completeMovement({
      movementId: parsedId.data,
      ...parsed.data,
    });

    return NextResponse.json({
      movementId: parsedId.data,
      status: 'completed',
    });
  } catch (error) {
    return movementApiErrorResponse(error, 'Failed to complete movement');
  }
}
