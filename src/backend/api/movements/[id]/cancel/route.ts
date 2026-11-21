import { cancelMovement } from '@/backend/services/dispatch';
import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/backend/lib/api-response';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    await cancelMovement({
      movementId: id,
      note: body.note ?? null,
    });

    return apiSuccess({ movementId: id, status: 'cancelled' });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to cancel movement';

    return apiError({ code: 'MOVEMENT_FAILED', message }, 400);
  }
}
