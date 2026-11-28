import { cancelMovementAction } from '@/actions/movements';
import { failedAction } from '@/actions/action-result';
import { actionResponse } from '@/lib/action-response';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params;

  let body: unknown;
  if (req.body === null) {
    body = {};
  } else {
    try {
      body = await req.json();
    } catch {
      return actionResponse(
        failedAction('Invalid JSON request body', 400, {
          code: 'INVALID_JSON',
        }),
      );
    }
  }

  return actionResponse(await cancelMovementAction(id, body));
}
