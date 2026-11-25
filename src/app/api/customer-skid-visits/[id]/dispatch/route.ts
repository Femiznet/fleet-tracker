import { NextRequest, NextResponse } from 'next/server';
import {
  apiErrorResponse,
  apiValidationErrorResponse,
} from '@/lib/api-errors';
import {
  CustomerSkidVisitError,
  dispatchCustomerSkidVisit,
} from '@/services/customer-skid-visits';
import { customerSkidVisitIdSchema } from '@/services/customer-skid-visits/validator';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parsedId = customerSkidVisitIdSchema.safeParse(id);
    if (!parsedId.success) {
      return apiValidationErrorResponse(parsedId.error, 'Invalid customer skid visit ID');
    }

    const data = await dispatchCustomerSkidVisit(parsedId.data);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof CustomerSkidVisitError) {
      return apiErrorResponse(error, 'Failed to dispatch customer skid visit', error.status);
    }
    return apiErrorResponse(error, 'Failed to dispatch customer skid visit');
  }
}
