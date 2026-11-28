import { createDispatchAction } from '@/actions/movements';
import { failedAction } from '@/actions/action-result';
import { actionResponse } from '@/lib/action-response';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return actionResponse(
      failedAction('Invalid or empty JSON request body', 400, {
        code: 'INVALID_JSON',
      }),
    );
  }

  return actionResponse(await createDispatchAction(body), 201);
}
