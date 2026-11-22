import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';
import { getCustomerById } from '@/backend/services/customers/query';
import { calculateCustomerUpdateForecast } from '@/backend/services/messages/forecast';
import { getLatestProcessedCustomerUpdate } from '@/backend/services/messages/queries';
import { CustomerUpdateMessageSchema } from '@/backend/services/messages/utils/updateParser';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Invalid customer ID' }, 400);
  }

  try {
    const customer = await getCustomerById(id);
    if (!customer) {
      return apiError({ code: 'NOT_FOUND', message: 'Customer not found' }, 404);
    }

    const update = await getLatestProcessedCustomerUpdate(id);
    if (!update) {
      return apiSuccess(null);
    }

    const parsedData =
      update.data === null ? null : CustomerUpdateMessageSchema.safeParse(update.data);
    if (parsedData && !parsedData.success) {
      return apiDbError(new Error('Stored customer update data is invalid'));
    }

    return apiSuccess(
      calculateCustomerUpdateForecast({
        messageId: update.messageId,
        receivedAt: update.receivedAt,
        parseStatus: update.status,
        warnings: update.warnings,
        data: parsedData?.data ?? null,
      })
    );
  } catch (error) {
    return apiDbError(error);
  }
}
