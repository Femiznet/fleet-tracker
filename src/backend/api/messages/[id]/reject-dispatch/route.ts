import { z } from 'zod';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';
import {
  DispatchReviewError,
  rejectDispatchMessage,
} from '@/backend/services/messages/dispatch-review-repository';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Invalid message ID' }, 400);
  }

  try {
    return apiSuccess(await rejectDispatchMessage(id));
  } catch (error) {
    if (error instanceof DispatchReviewError) {
      return apiError({ code: error.code, message: error.message }, error.status);
    }
    return apiDbError(error);
  }
}
