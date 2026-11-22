import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';
import { markMovementNotified } from '@/backend/services/dispatch';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Invalid movement ID' }, 400);
  }

  try {
    const updated = await markMovementNotified(id);
    if (!updated) {
      return apiError(
        { code: 'INVALID_NOTIFICATION_STATE', message: 'This movement has no pending reminder' },
        409
      );
    }
    return apiSuccess({ movementId: id, status: 'notified' });
  } catch (error) {
    return apiDbError(error);
  }
}
