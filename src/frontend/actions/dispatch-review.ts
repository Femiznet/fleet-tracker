import { z } from 'zod';
import { parseResponse, requestJson } from '@/frontend/actions/http';
import {
  DispatchDetailsSchema,
  DispatchMessageSchema,
  DispatchNotificationSchema,
  PaginationMetaSchema,
  type DispatchDetails,
  type DispatchMessage,
  type DispatchNotification,
  type PaginationMeta,
  type ReviewStatus,
} from '@/frontend/types/dispatch-review';

const MessageListResponseSchema = z.object({
  data: z.array(DispatchMessageSchema),
  meta: z.object({ pagination: PaginationMetaSchema }).optional(),
});

const NotificationListResponseSchema = z.object({
  data: z.array(DispatchNotificationSchema),
});

const ApproveResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('approved'),
    movementId: z.string(),
    notificationDueAt: z.string(),
    notificationText: z.string(),
  }),
  z.object({
    status: z.literal('duplicate'),
    duplicateOfMessageId: z.string(),
  }),
]);

const RejectResponseSchema = z.object({ status: z.literal('rejected') });

export async function listDispatchMessages(input: {
  reviewStatus: ReviewStatus | 'all';
  page: number;
  limit: number;
}): Promise<{ messages: DispatchMessage[]; pagination: PaginationMeta | null }> {
  const params = new URLSearchParams({
    type: 'dispatch',
    page: String(input.page),
    limit: String(input.limit),
  });
  if (input.reviewStatus !== 'all') {
    params.set('reviewStatus', input.reviewStatus);
  }

  const response = parseResponse(
    await requestJson(`/api/messages?${params.toString()}`),
    MessageListResponseSchema,
    'The dispatch inbox returned an invalid response.'
  );

  return {
    messages: response.data,
    pagination: response.meta?.pagination ?? null,
  };
}

export async function listDispatchNotifications(): Promise<DispatchNotification[]> {
  const response = parseResponse(
    await requestJson('/api/dispatch-notifications'),
    NotificationListResponseSchema,
    'The dispatch reminders returned an invalid response.'
  );
  return response.data;
}

export async function approveDispatchMessage(messageId: string, details: DispatchDetails) {
  const body = z.object({ details: DispatchDetailsSchema.partial() }).parse({ details });
  const response = parseResponse(
    await requestJson(`/api/messages/${encodeURIComponent(messageId)}/approve-dispatch`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    z.object({ data: ApproveResponseSchema }),
    'The dispatch approval returned an invalid response.'
  );
  return response.data;
}

export async function rejectDispatchMessage(messageId: string) {
  const response = parseResponse(
    await requestJson(`/api/messages/${encodeURIComponent(messageId)}/reject-dispatch`, {
      method: 'POST',
    }),
    z.object({ data: RejectResponseSchema }),
    'The dispatch rejection returned an invalid response.'
  );
  return response.data;
}
