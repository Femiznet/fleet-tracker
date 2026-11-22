// app/api/cron/process-messages/route.ts

import { processPendingMessages } from '@/backend/actions/messages/process';
import { apiError, apiSuccess } from '@/backend/lib/api-response';

// export const dynamic = 'force-dynamic'; // never cache this route
// export const maxDuration = 60;          // seconds; raise if your backlog can be large

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return apiError({ code: 'CONFIG_ERROR', message: 'CRON_SECRET is not set' }, 500);
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return apiError({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401);
  }

  try {
    const summary = await processPendingMessages();
    return apiSuccess({ summary });
  } catch (err) {
    console.error('process-messages cron failed', err);
    return apiError({ code: 'PROCESSING_FAILED', message: 'Processing failed' }, 500);
  }
}
