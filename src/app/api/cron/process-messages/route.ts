// app/api/cron/process-messages/route.ts

import {
  messagesFeatureAvailable,
  processPendingMessages,
} from '@/generated/messages-feature';
import { apiErrorResponse } from '@/lib/api-errors';
import { cronAuthorizationError } from '@/lib/cron-auth';

// export const dynamic = 'force-dynamic'; // never cache this route
// export const maxDuration = 60;          // seconds; raise if your backlog can be large

export async function GET(request: Request) {
  const authorizationError = cronAuthorizationError(request);
  if (authorizationError) return authorizationError;
  if (!messagesFeatureAvailable) {
    return Response.json(
      { ok: false, error: 'The messages feature is not installed' },
      { status: 503 },
    );
  }

  try {
    const summary = await processPendingMessages();
    return Response.json({ ok: true, summary });
  } catch (err) {
    return apiErrorResponse(err, 'Failed to process pending messages', 500, {
      ok: false,
    });
  }
}
