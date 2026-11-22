import { createPickup } from '@/backend/services/dispatch';
import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/backend/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.truckId || !body.customerId) {
      return apiError(
        { code: 'VALIDATION_ERROR', message: 'truckId and customerId are required' },
        400
      );
    }

    const movementId = await createPickup({
      truckId: body.truckId,
      customerId: body.customerId,
      skidIdIn: body.skidIdIn ?? null,
      note: body.note ?? null,
      forceOverride: Boolean(body.forceOverride),
    });

    return apiSuccess({ movementId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create pickup';
    const requiresOverride = message.includes('Use manual override');

    return apiError(
      {
        code: requiresOverride ? 'OVERRIDE_REQUIRED' : 'MOVEMENT_FAILED',
        message,
        field: requiresOverride ? 'forceOverride' : undefined,
      },
      requiresOverride ? 409 : 400
    );
  }
}
