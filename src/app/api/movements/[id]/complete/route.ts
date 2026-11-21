import { completeMovement } from '@/services/dispatch';
import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    await completeMovement({
      movementId: id,
      skidIdIn: body.skidIdIn ?? null,
      note: body.note ?? null,
      forceOverride: Boolean(body.forceOverride),
    });

    return apiSuccess({ movementId: id, status: 'completed' });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to complete movement';
    const requiresOverride = message.includes('manual override');

    return apiError({ code: requiresOverride ? 'OVERRIDE_REQUIRED' : 'MOVEMENT_FAILED', message, field: requiresOverride ? 'forceOverride' : undefined }, requiresOverride ? 409 : 400);
  }
}
