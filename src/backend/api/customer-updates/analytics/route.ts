import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';
import { getCustomerUpdateAnalytics } from '@/backend/services/customer-updates/analytics';

const querySchema = z.object({ period: z.enum(['24h', '7d', '30d']).default('7d') });

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    period: request.nextUrl.searchParams.get('period') ?? '7d',
  });
  if (!parsed.success) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Invalid analytics period' }, 400);
  }

  try {
    return apiSuccess(await getCustomerUpdateAnalytics(parsed.data.period));
  } catch (error) {
    return apiDbError(error);
  }
}
