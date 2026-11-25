import { NextRequest, NextResponse } from 'next/server';
import {
  apiErrorResponse,
  apiValidationErrorResponse,
} from '@/lib/api-errors';
import {
  createCustomerSkidVisit,
  CustomerSkidVisitError,
  getCustomerSkidVisits,
} from '@/services/customer-skid-visits';
import {
  createCustomerSkidVisitSchema,
  customerSkidVisitListQuerySchema,
} from '@/services/customer-skid-visits/validator';

export async function GET(request: NextRequest) {
  try {
    const query = customerSkidVisitListQuerySchema.safeParse({
      includeHistory:
        new URL(request.url).searchParams.get('includeHistory') ?? undefined,
    });
    if (!query.success) {
      return apiValidationErrorResponse(query.error, 'Invalid customer visit query');
    }

    const data = await getCustomerSkidVisits(query.data.includeHistory);
    return NextResponse.json({ data });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to fetch customer skid visits');
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

    const parsed = createCustomerSkidVisitSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationErrorResponse(parsed.error, 'Invalid customer skid visit');
    }

    const data = await createCustomerSkidVisit(parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof CustomerSkidVisitError) {
      return apiErrorResponse(
        error,
        'Failed to register customer skid visit',
        error.status
      );
    }
    return apiErrorResponse(error, 'Failed to register customer skid visit');
  }
}
