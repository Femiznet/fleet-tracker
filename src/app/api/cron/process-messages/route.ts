// app/api/cron/process-messages/route.ts

import { processPendingMessages } from "@/actions/messages/process";

// export const dynamic = 'force-dynamic'; // never cache this route
// export const maxDuration = 60;          // seconds; raise if your backlog can be large

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: 'CRON_SECRET is not set' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const summary = await processPendingMessages();
    return Response.json({ ok: true, summary });
  } catch (err) {
    console.error('process-messages cron failed', err);
    return Response.json({ ok: false, error: 'processing failed' }, { status: 500 });
  }
}