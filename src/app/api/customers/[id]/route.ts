import { NextResponse } from 'next/server';
import { getCustomerById } from '@/services/customers/query';
import {
  deleteCustomerAction,
  updateCustomerAction,
} from '@/actions/customers';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const data = await getCustomerById(id);

    if (!data) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await req.json();
    const result = await updateCustomerAction(id, body);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (!result.data) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const result = await deleteCustomerAction(id);

    if (!result.data) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}
