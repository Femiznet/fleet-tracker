import { NextRequest, NextResponse } from 'next/server';
import {
  apiErrorResponse,
  apiValidationErrorResponse,
} from '@/lib/api-errors';
import {
  CustomerSkidLoadingError,
  dispatchCustomerSkidLoading,
} from '@/services/customer-skid-loadings';
import { customerSkidLoadingIdSchema } from '@/services/customer-skid-loadings/validator';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parsedId = customerSkidLoadingIdSchema.safeParse(id);
    if (!parsedId.success) {
      return apiValidationErrorResponse(parsedId.error, 'Invalid customer skid loading ID');
    }

    const data = await dispatchCustomerSkidLoading(parsedId.data);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof CustomerSkidLoadingError) {
      return apiErrorResponse(error, 'Failed to dispatch customer skid loading', error.status);
    }
    return apiErrorResponse(error, 'Failed to dispatch customer skid loading');
  }
}
