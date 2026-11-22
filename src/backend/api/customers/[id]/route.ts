import { getCustomerById } from '@/backend/services/customers/query';
import { deleteCustomerAction, updateCustomerAction } from '@/backend/actions/customers';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const data = await getCustomerById(id);

    if (!data) {
      return apiError({ code: 'NOT_FOUND', message: 'Customer not found' }, 404);
    }

    return apiSuccess(data);
  } catch (error) {
    return apiDbError(error);
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await req.json();
    const result = await updateCustomerAction(id, body);

    if (!result.success) {
      return apiError(
        { code: 'VALIDATION_ERROR', message: 'Invalid customer data', details: result.error },
        400
      );
    }

    if (!result.data) {
      return apiError({ code: 'NOT_FOUND', message: 'Customer not found' }, 404);
    }

    return apiSuccess(result.data);
  } catch (error) {
    return apiDbError(error);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const result = await deleteCustomerAction(id);

    if (!result.data) {
      return apiError({ code: 'NOT_FOUND', message: 'Customer not found' }, 404);
    }

    return apiSuccess(result.data);
  } catch (error) {
    return apiDbError(error);
  }
}
