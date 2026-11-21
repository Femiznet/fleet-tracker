import { z } from 'zod';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';
import {
  approveDispatchMessage,
  DispatchReviewError,
} from '@/backend/services/messages/dispatch-review-repository';
import { DispatchDetailsSchema } from '@/backend/services/messages/utils/dispatchParser';

type RouteContext = { params: Promise<{ id: string }> };

const requestSchema = z.object({
  details: DispatchDetailsSchema.partial().optional(),
});

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Invalid message ID' }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'A valid JSON request body is required' }, 400);
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'Invalid dispatch review details',
      details: parsed.error.flatten(),
    }, 400);
  }

  try {
    return apiSuccess(await approveDispatchMessage(id, parsed.data.details));
  } catch (error) {
    if (error instanceof DispatchReviewError) {
      return apiError({ code: error.code, message: error.message }, error.status);
    }
    return apiDbError(error);
  }
}
