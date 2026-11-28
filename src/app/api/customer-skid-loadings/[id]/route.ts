import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse, apiValidationErrorResponse } from '@/lib/api-errors';
import {
  CustomerSkidLoadingError,
  customerSkidLoadingsFeatureAvailable,
  customerSkidLoadingsFeatureUnavailableResponse,
  updateCustomerSkidLoading,
  customerSkidLoadingIdSchema,
  updateCustomerSkidLoadingSchema,
} from '@/generated/customer-skid-loadings-feature';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!customerSkidLoadingsFeatureAvailable) {
    return NextResponse.json(customerSkidLoadingsFeatureUnavailableResponse, {
      status: 503,
    });
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Request body must be valid JSON' },
        { status: 400 },
      );
    }

    const parsed = updateCustomerSkidLoadingSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationErrorResponse(
        parsed.error,
        'Invalid customer skid loading update',
      );
    }

    const { id } = await context.params;
    const parsedId = customerSkidLoadingIdSchema.safeParse(id);
    if (!parsedId.success) {
      return apiValidationErrorResponse(
        parsedId.error,
        'Invalid customer skid loading ID',
      );
    }

    const data = await updateCustomerSkidLoading(parsedId.data, parsed.data);

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof CustomerSkidLoadingError) {
      return apiErrorResponse(
        error,
        'Failed to update customer skid loading',
        error.status,
      );
    }
    return apiErrorResponse(error, 'Failed to update customer skid loading');
  }
}
