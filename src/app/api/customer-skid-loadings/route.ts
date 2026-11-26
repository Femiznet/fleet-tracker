import { NextRequest, NextResponse } from 'next/server';
import {
  apiErrorResponse,
  apiValidationErrorResponse,
} from '@/lib/api-errors';
import {
  createCustomerSkidLoading,
  CustomerSkidLoadingError,
  getCustomerSkidLoadings,
} from '@/services/customer-skid-loadings';
import {
  createCustomerSkidLoadingSchema,
  customerSkidLoadingListQuerySchema,
} from '@/services/customer-skid-loadings/validator';

export async function GET(request: NextRequest) {
  try {
    const query = customerSkidLoadingListQuerySchema.safeParse({
      includeHistory:
        new URL(request.url).searchParams.get('includeHistory') ?? undefined,
    });
    if (!query.success) {
      return apiValidationErrorResponse(query.error, 'Invalid customer skid loading query');
    }

    const data = await getCustomerSkidLoadings(query.data.includeHistory);
    return NextResponse.json({ data });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to fetch customer skid loadings');
  }
}

export async function POST(request: NextRequest) {
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

    const parsed = createCustomerSkidLoadingSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationErrorResponse(parsed.error, 'Invalid customer skid loading');
    }

    const data = await createCustomerSkidLoading(parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof CustomerSkidLoadingError) {
      return apiErrorResponse(
        error,
        'Failed to register customer skid loading',
        error.status
      );
    }
    return apiErrorResponse(error, 'Failed to register customer skid loading');
  }
}
