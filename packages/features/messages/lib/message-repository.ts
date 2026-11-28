import { and, eq } from 'drizzle-orm';
import { db } from '@fleet/database';
import {
  messages,
  type GreenApiSenderData,
  type Message,
} from '@fleet/database/schema';

export type MessageWriteResult =
  { success: true; data: Message } | { success: false; message: string };

type MessageIdentity = {
  customerId: string;
  messageId: string;
};

type MessageMetadata = MessageIdentity & {
  senderData: GreenApiSenderData;
};

type MessageContent = {
  textMessage: string;
  messageType: 'update' | 'dispatch';
};

export async function createMessage(
  message: MessageMetadata & MessageContent,
): Promise<MessageWriteResult> {
  const [savedMessage] = await db
    .insert(messages)
    .values({
      customerId: message.customerId,
      externalId: message.messageId,
      text: message.textMessage,
      type: message.messageType,
      metadata: message.senderData,
    })
    .onConflictDoNothing({ target: messages.externalId })
    .returning();

  if (savedMessage) return { success: true, data: savedMessage };

  const [existingMessage] = await db
    .select()
    .from(messages)
    .where(eq(messages.externalId, message.messageId))
    .limit(1);

  if (!existingMessage) {
    throw new Error('Duplicate message could not be retrieved');
  }
  if (existingMessage.customerId !== message.customerId) {
    return {
      success: false,
      message: `MESSAGE_ID_ALREADY_EXISTS: ${message.messageId}`,
    };
  }

  return { success: true, data: existingMessage };
}

export async function editMessage(
  message: MessageMetadata & MessageContent,
): Promise<MessageWriteResult> {
  const [updatedMessage] = await db
    .update(messages)
    .set({
      text: message.textMessage,
      metadata: message.senderData,
      type: message.messageType,
      isProcessed: false,
    })
    .where(
      and(
        eq(messages.customerId, message.customerId),
        eq(messages.externalId, message.messageId),
      ),
    )
    .returning();

  if (!updatedMessage) {
    return {
      success: false,
      message: `MESSAGE_NOT_FOUND_FOR_EDIT: ${message.messageId}`,
    };
  }

  return { success: true, data: updatedMessage };
}

export async function deleteMessage(
  message: MessageIdentity,
): Promise<MessageWriteResult> {
  const [deletedMessage] = await db
    .delete(messages)
    .where(
      and(
        eq(messages.customerId, message.customerId),
        eq(messages.externalId, message.messageId),
      ),
    )
    .returning();

  if (!deletedMessage) {
    return {
      success: false,
      message: `MESSAGE_NOT_FOUND_FOR_DELETE: ${message.messageId}`,
    };
  }

  return { success: true, data: deletedMessage };
}
