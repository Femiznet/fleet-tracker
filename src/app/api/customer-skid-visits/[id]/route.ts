import { NextRequest, NextResponse } from 'next/server';
import {
  apiErrorResponse,
  apiValidationErrorResponse,
} from '@/lib/api-errors';
import {
  CustomerSkidVisitError,
  updateCustomerSkidVisit,
} from '@/services/customer-skid-visits';
import {
  customerSkidVisitIdSchema,
  updateCustomerSkidVisitSchema,
} from '@/services/customer-skid-visits/validator';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Request body must be valid JSON' },
        { status: 400 }
      );
    }

    const parsed = updateCustomerSkidVisitSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationErrorResponse(parsed.error, 'Invalid customer skid visit update');
    }

    const { id } = await context.params;
    const parsedId = customerSkidVisitIdSchema.safeParse(id);
    if (!parsedId.success) {
      return apiValidationErrorResponse(parsedId.error, 'Invalid customer skid visit ID');
    }

    const data = await updateCustomerSkidVisit(parsedId.data, parsed.data);

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof CustomerSkidVisitError) {
      return apiErrorResponse(
        error,
        'Failed to update customer skid visit',
        error.status
      );
    }
    return apiErrorResponse(error, 'Failed to update customer skid visit');
  }
}
