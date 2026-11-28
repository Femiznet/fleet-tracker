import { NextResponse } from 'next/server';
import { apiErrorResponse, apiValidationErrorResponse } from '@/lib/api-errors';
import {
  customerIdSchema,
  customersFeatureAvailable,
  customersFeatureUnavailableResponse,
  findCustomerById,
} from '@/generated/customers-feature';
import {
  deleteCustomerAction,
  updateCustomerAction,
} from '@/actions/customers';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, { params }: RouteContext) {
  if (!customersFeatureAvailable) {
    return NextResponse.json(customersFeatureUnavailableResponse, {
      status: 503,
    });
  }

  try {
    const { id } = await params;
    const parsedId = customerIdSchema.safeParse(id);
    if (!parsedId.success) {
      return apiValidationErrorResponse(parsedId.error, 'Invalid customer ID');
    }

    const data = await findCustomerById(parsedId.data);

    if (!data) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to fetch customer');
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
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
    const { id } = await params;
    const parsedId = customerIdSchema.safeParse(id);
    if (!parsedId.success) {
      return apiValidationErrorResponse(parsedId.error, 'Invalid customer ID');
    }

    const result = await updateCustomerAction(parsedId.data, body);

    if (!result.success) {
      return apiErrorResponse(result.error, 'Invalid customer data', 400);
    }

    if (!result.data) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to update customer');
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  if (!customersFeatureAvailable) {
    return NextResponse.json(customersFeatureUnavailableResponse, {
      status: 503,
    });
  }

  try {
    const { id } = await params;
    const parsedId = customerIdSchema.safeParse(id);
    if (!parsedId.success) {
      return apiValidationErrorResponse(parsedId.error, 'Invalid customer ID');
    }

    const result = await deleteCustomerAction(parsedId.data);
    if (!result.success) {
      return apiErrorResponse(result.error, 'Invalid customer ID', 400);
    }

    if (!result.data) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to delete customer');
  }
}
