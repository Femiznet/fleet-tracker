import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-errors';
import {
  customersFeatureAvailable,
  customersFeatureUnavailableResponse,
  listCustomers,
} from '@/generated/customers-feature';
import { createCustomerAction } from '@/actions/customers';

export async function GET() {
  if (!customersFeatureAvailable) {
    return NextResponse.json(customersFeatureUnavailableResponse, {
      status: 503,
    });
  }

  try {
    const data = await listCustomers();
    return NextResponse.json({ data });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to fetch customers');
  }
}

export async function POST(req: Request) {
  if (!customersFeatureAvailable) {
    return NextResponse.json(customersFeatureUnavailableResponse, {
      status: 503,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON' },
      { status: 400 },
    );
  }

  try {
    const result = await createCustomerAction(body);

    if (!result.success) {
      return apiErrorResponse(result.error, 'Invalid customer data', 400);
    }

    if (!result.data) {
      return NextResponse.json(
        { error: 'Customer not created' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to create customer');
  }
}
