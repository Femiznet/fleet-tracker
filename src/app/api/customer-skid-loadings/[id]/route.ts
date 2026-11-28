import { updateCustomerSkidLoadingAction } from '@/actions/customer-skid-loadings';
import { failedAction } from '@/actions/action-result';
import { actionResponse } from '@/lib/action-response';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return actionResponse(
      failedAction('Request body must be valid JSON', 400, {
        code: 'INVALID_JSON',
      }),
    );
  }

  const { id } = await context.params;
  return actionResponse(await updateCustomerSkidLoadingAction(id, body));
}
