import { processGreenApiMessage } from '@/actions/messages';
import { getApiErrorInfo } from '@/lib/api-errors';
import { parseGreenApiMessage } from '@/services/messages/validator';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const messageResult = parseGreenApiMessage(body);

    if (messageResult.status === 'invalid') {
      return NextResponse.json({
        ok: false,
        error: messageResult.reason,
        ...(messageResult.error ? { details: messageResult.error } : {}),
      });
    }

    const result = await processGreenApiMessage(messageResult.data);
    if (!result.success) {
      return NextResponse.json({ ok: false, error: result.message });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Keep the webhook acknowledged with HTTP 200 to avoid automatic provider retries.
    return NextResponse.json({
      ok: false,
      ...getApiErrorInfo(error, 'Failed to process webhook message'),
    });
  }
}