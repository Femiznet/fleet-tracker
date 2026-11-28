import { apiErrorResponse } from '@/lib/api-errors';
import {
  handleIncomingMessage,
  messagesFeatureAvailable,
} from '@/generated/messages-feature';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  if (!messagesFeatureAvailable) {
    return NextResponse.json({
      ok: false,
      error: 'MESSAGES_FEATURE_UNAVAILABLE',
      message: 'The messages feature is not installed',
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Request body must be valid JSON' },
      { status: 400 },
    );
  }

  try {
    const result = await handleIncomingMessage(body);

    if (result.status === 'invalid') {
      return NextResponse.json({
        ok: false,
        error: result.reason,
        ...(result.error ? { details: result.error } : {}),
      });
    }

    if (result.status === 'failed') {
      return NextResponse.json({ ok: false, error: result.message });
    }

    if (result.status === 'unavailable') {
      return NextResponse.json({
        ok: false,
        error: 'MESSAGES_FEATURE_UNAVAILABLE',
        message: 'The messages feature is not installed',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to process webhook message', 500);
  }
}
