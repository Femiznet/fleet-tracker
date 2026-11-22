import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';
import { getCustomerById } from '@/backend/services/customers/query';
import { getCustomerUpdateAnalytics } from '@/backend/services/customer-updates/analytics';

const querySchema = z.object({ period: z.enum(['24h', '7d', '30d']).default('7d') });
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Invalid customer ID' }, 400);
  }

  const parsed = querySchema.safeParse({
    period: request.nextUrl.searchParams.get('period') ?? '7d',
  });
  if (!parsed.success) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Invalid analytics period' }, 400);
  }

  try {
    const customer = await getCustomerById(id);
    if (!customer) return apiError({ code: 'NOT_FOUND', message: 'Customer not found' }, 404);
    return apiSuccess(await getCustomerUpdateAnalytics(parsed.data.period, id));
  } catch (error) {
    return apiDbError(error);
  }
}
