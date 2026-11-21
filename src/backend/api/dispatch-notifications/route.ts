import { NextRequest } from 'next/server';
import { apiDbError, apiSuccess } from '@/backend/lib/api-response';
import { listDispatchNotifications } from '@/backend/services/messages/dispatch-review-repository';

export async function GET(request: NextRequest) {
  const overdueOnly = request.nextUrl.searchParams.get('overdueOnly') === 'true';

  try {
    return apiSuccess(await listDispatchNotifications(overdueOnly));
  } catch (error) {
    return apiDbError(error);
  }
}
