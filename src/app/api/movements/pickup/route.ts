import {
  createPickup,
  movementsFeatureAvailable,
  movementsFeatureUnavailableResponse,
} from '@/generated/movements-feature';
import { apiValidationErrorResponse } from '@/lib/api-errors';
import { movementApiErrorResponse } from '@/lib/movement-api-errors';
import { createPickupRequestSchema } from '@/lib/validation/movements';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  if (!movementsFeatureAvailable) {
    return NextResponse.json(movementsFeatureUnavailableResponse, {
      status: 503,
    });
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

  const parsed = createPickupRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationErrorResponse(parsed.error, 'Invalid pickup request');
  }

  try {
    const movementId = await createPickup(parsed.data);
    return NextResponse.json({ movementId }, { status: 201 });
  } catch (error) {
    return movementApiErrorResponse(error, 'Failed to create pickup', true);
  }
}
