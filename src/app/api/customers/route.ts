import { createCustomerAction, listCustomersAction } from '@/actions/customers';
import { failedAction } from '@/actions/action-result';
import { actionResponse } from '@/lib/action-response';

export async function GET() {
  return actionResponse(await listCustomersAction());
}

export async function POST(req: Request) {
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

  return actionResponse(await createCustomerAction(body), 201);
}
