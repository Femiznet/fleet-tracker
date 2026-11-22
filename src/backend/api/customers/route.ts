import { NextRequest } from 'next/server';
import { listCustomers } from '@/backend/services/customers/query';
import { createCustomerAction } from '@/backend/actions/customers';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';
import { getPagination, getPaginationMeta } from '@/backend/lib/pagination';

export async function GET(request: NextRequest) {
  try {
    const pagination = getPagination(request.nextUrl.searchParams);
    const search = request.nextUrl.searchParams.get('search')?.trim() || undefined;
    const result = await listCustomers(pagination.page, pagination.limit, search);
    return apiSuccess(result.rows, {
      pagination: getPaginationMeta(pagination.page, pagination.limit, result.total),
    });
  } catch (error) {
    return apiDbError(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await createCustomerAction(body);

    if (!result.success) {
      return apiError(
        { code: 'VALIDATION_ERROR', message: 'Invalid customer data', details: result.error },
        400
      );
    }

    if (!result.data) {
      return apiError({ code: 'CREATE_FAILED', message: 'Customer not created' }, 500);
    }

    return apiSuccess(result.data, { status: 201 });
  } catch (error) {
    return apiDbError(error);
  }
}
