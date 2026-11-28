import { dispatchCustomerSkidLoadingAction } from '@/actions/customer-skid-loadings';
import { actionResponse } from '@/lib/action-response';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return actionResponse(await dispatchCustomerSkidLoadingAction(id));
}
