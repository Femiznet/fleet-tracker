import {
  getPlantStatusAction,
  updatePlantStatusAction,
} from '@/actions/plant-status';
import { failedAction } from '@/actions/action-result';
import { actionResponse } from '@/lib/action-response';

/**
 * GET /api/plant-status
 * Loads everything the officer needs to render the hourly Plant Status form.
 */
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get('date') ?? undefined;
  return actionResponse(await getPlantStatusAction(date));
}

/**
 * POST /api/plant-status
 * Updates the current plant status and returns the live WhatsApp text.
 */
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

  return actionResponse(await updatePlantStatusAction(body));
}
