import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-errors';
import { getCustomers } from '@/services/customers/query';
import { createCustomerAction } from '@/actions/customers';

export async function GET() {
  try {
    const data = await getCustomers();
    return NextResponse.json({ data });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to fetch customers');
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await createCustomerAction(body);

    if (!result.success) {
      return apiErrorResponse(result.error, 'Invalid customer data', 400);
    }

    if (!result.data) {
      return NextResponse.json({ error: 'Customer not created' }, { status: 404 });
    }

    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to create customer');
  }
}
