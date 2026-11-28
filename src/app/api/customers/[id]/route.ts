import {
  deleteCustomerAction,
  getCustomerAction,
  updateCustomerAction,
} from '@/actions/customers';
import { failedAction } from '@/actions/action-result';
import { actionResponse } from '@/lib/action-response';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  return actionResponse(await getCustomerAction(id));
}

export async function PATCH(req: Request, { params }: RouteContext) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return actionResponse(
      failedAction('Request body must be valid JSON', 400, {
        code: 'INVALID_JSON',
      }),
    );
  }

  const { id } = await params;
  return actionResponse(await updateCustomerAction(id, body));
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  return actionResponse(await deleteCustomerAction(id));
}
