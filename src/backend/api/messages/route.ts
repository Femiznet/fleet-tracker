import { processGreenApiMessage } from '@/backend/actions/messages';
import { returnValueDebugger } from '@/backend/lib/errors';
import {
  parseGreenApiMessage,
  parseGreenApiOutgoingMessage,
} from '@/backend/services/messages/validator';
import { NextRequest } from 'next/server';
import { apiDbError, apiSuccess } from '@/backend/lib/api-response';
import {
  listMessages,
  recordDispatchNotification,
} from '@/backend/services/messages/dispatch-review-repository';
import { getPagination, getPaginationMeta } from '@/backend/lib/pagination';

export async function GET(request: NextRequest) {
  const pagination = getPagination(request.nextUrl.searchParams);
  const query = request.nextUrl.searchParams;
  const typeValue = query.get('type');
  const reviewValue = query.get('reviewStatus');
  const type = typeValue === 'update' || typeValue === 'dispatch' ? typeValue : undefined;
  const reviewStatus =
    reviewValue === 'pending' ||
    reviewValue === 'duplicate' ||
    reviewValue === 'approved' ||
    reviewValue === 'rejected'
      ? reviewValue
      : undefined;

  try {
    const result = await listMessages({
      page: pagination.page,
      limit: pagination.limit,
      type,
      reviewStatus,
    });
    return apiSuccess(result.rows, {
      pagination: getPaginationMeta(pagination.page, pagination.limit, result.total),
    });
  } catch (error) {
    return apiDbError(error);
  }
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json();
  const outgoingMessage = parseGreenApiOutgoingMessage(body);
  if (outgoingMessage) {
    await recordDispatchNotification(outgoingMessage);
    return apiSuccess({ ok: true });
  }

  const messageResult = parseGreenApiMessage(body);
  if (messageResult.status === 'invalid') {
    returnValueDebugger(messageResult);
    return apiSuccess({ ok: true });
  }

  if (messageResult.data.textMessage) {
    await recordDispatchNotification({
      chatId: messageResult.data.senderData.chatId,
      messageId: messageResult.data.messageId,
      sentAt: new Date(),
      text: messageResult.data.textMessage,
    });
  }

  const result = await processGreenApiMessage(messageResult.data);
  if (!result.success) returnValueDebugger(result);

  return apiSuccess({ ok: true });
}
