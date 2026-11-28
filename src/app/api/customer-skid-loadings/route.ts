import {
  createCustomerSkidLoadingAction,
  listCustomerSkidLoadingsAction,
} from '@/actions/customer-skid-loadings';
import { failedAction } from '@/actions/action-result';
import { actionResponse } from '@/lib/action-response';

export async function GET(request: Request) {
  const includeHistory =
    new URL(request.url).searchParams.get('includeHistory') ?? undefined;
  return actionResponse(await listCustomerSkidLoadingsAction(includeHistory));
}

export async function POST(request: Request) {
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

  return actionResponse(await createCustomerSkidLoadingAction(body), 201);
}
