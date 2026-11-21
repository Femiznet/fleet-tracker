import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/backend/db';
import { messages, processedMessages, type Message } from '@/backend/db/schema/messages';
import type {
  GreenApiSenderData,
} from '@/backend/services/messages/validator';

export type ProcessGreenApiMessageResult =
  | { success: true; data: Message }
  | { success: false; message: string };

export async function getLatestProcessedCustomerUpdate(customerId: string) {
  const [result] = await db
    .select({
      messageId: messages.id,
      receivedAt: messages.createdAt,
      status: processedMessages.status,
      warnings: processedMessages.warnings,
      data: processedMessages.data,
    })
    .from(messages)
    .innerJoin(processedMessages, eq(processedMessages.messageId, messages.id))
    .where(and(eq(messages.customerId, customerId), eq(messages.type, 'update')))
    .orderBy(desc(messages.createdAt))
    .limit(1);

  return result ?? null;
}

type BaseHandlerParams = {
  customerId: string;
  messageId: string;
  senderData: GreenApiSenderData;
};

// 1. Create handler
export async function saveGreenApiMessage({
  customerId,
  messageId,
  textMessage,
  senderData,
  messageType
}: BaseHandlerParams & { textMessage: string, messageType: 'update' | 'dispatch' }): Promise<ProcessGreenApiMessageResult> {
  const [savedMessage] = await db
    .insert(messages)
    .values({
      customerId,
      externalId: messageId,
      text: textMessage,
      type: messageType,
      metadata: senderData,
    })
    .returning();

  return { success: true, data: savedMessage };
}

// 2. Edit handler
export async function editGreenApiMessage({
  customerId,
  messageId,
  textMessage,
  senderData,
  messageType
}: BaseHandlerParams & { textMessage: string, messageType: 'update' | 'dispatch' }): Promise<ProcessGreenApiMessageResult> {
  const [updatedMessage] = await db
    .update(messages)
    .set({
      text: textMessage,
      metadata: senderData,
      type: messageType,
      isProcessed: false
    })
    .where(
      and(
        eq(messages.customerId, customerId),
        eq(messages.externalId, messageId)
      )
    )
    .returning();

  if (!updatedMessage) {
    return {
      success: false,
      message: `MESSAGE_NOT_FOUND_FOR_EDIT: ${messageId}`,
    };
  }

  return { success: true, data: updatedMessage };
}

// 3. Delete handler
export async function deleteGreenApiMessage({
  customerId,
  messageId,
}: Omit<BaseHandlerParams, 'senderData'>): Promise<ProcessGreenApiMessageResult> {
  const [deletedMessage] = await db
    .delete(messages)
    .where(
      and(
        eq(messages.customerId, customerId),
        eq(messages.externalId, messageId)
      )
    )
    .returning();

  if (!deletedMessage) {
    return {
      success: false,
      message: `MESSAGE_NOT_FOUND_FOR_DELETE: ${messageId}`,
    };
  }

  return { success: true, data: deletedMessage };
}