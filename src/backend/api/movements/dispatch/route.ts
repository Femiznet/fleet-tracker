import { createDispatch } from '@/backend/services/dispatch';
import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/backend/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.truckId || !body.customerId || !body.skidIdOut) {
      return apiError({ code: 'VALIDATION_ERROR', message: 'truckId, customerId, and skidIdOut are required' }, 400);
    }

    const movementId = await createDispatch({
      truckId: body.truckId,
      customerId: body.customerId,
      skidIdOut: body.skidIdOut,
      note: body.note ?? null,
      forceOverride: Boolean(body.forceOverride),
    });

    return apiSuccess({ movementId }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create dispatch';
    const requiresOverride = message.includes('Use manual override');

    return apiError({ code: requiresOverride ? 'OVERRIDE_REQUIRED' : 'MOVEMENT_FAILED', message, field: requiresOverride ? 'forceOverride' : undefined }, requiresOverride ? 409 : 400);
  }
}
