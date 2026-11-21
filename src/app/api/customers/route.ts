import { NextResponse } from 'next/server';
import { getCustomers } from '@/services/customers/query';
import { createCustomerAction } from '@/actions/customers';

export async function GET() {
  try {
    const data = await getCustomers();
    return NextResponse.json({ data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await createCustomerAction(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (!result.data) {
      return NextResponse.json({ error: 'Customer not created' }, { status: 404 });
    }

    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}
