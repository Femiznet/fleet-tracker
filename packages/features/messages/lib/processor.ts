import { asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@fleet/database';
import {
  messages,
  processedMessages,
  type Message,
  type NewProcessedMessage,
} from '@fleet/database/schema';
import type { GreenApiParsedMessage } from './webhook-validator';
import { isDispatchDetails, parseDispatchDetails } from './dispatch-parser';
import { isUpdate, parseUpdate } from './update-parser';
import { parseGreenApiMessage } from './webhook-validator';
import {
  createMessage,
  deleteMessage,
  editMessage,
  type MessageWriteResult,
} from './message-repository';

type ProcessingOutcome = 'ok' | 'needs_review' | 'failed' | 'ignored';
export type CustomerGeofenceLookup = (
  geofenceName: string,
) => Promise<{ id: string } | null>;

function rowFromMessage(
  message: Message,
  parse: typeof parseUpdate | typeof parseDispatchDetails,
): NewProcessedMessage | null {
  try {
    const result = parse(message.text);
    return {
      messageId: message.id,
      customerId: message.customerId,
      status: result.status,
      warnings: result.warnings,
      data: result.data,
    };
  } catch (error) {
    return {
      messageId: message.id,
      customerId: message.customerId,
      status: 'failed',
      warnings: [error instanceof Error ? error.message : String(error)],
      data: null,
    };
  }
}

async function saveProcessedMessages(rows: NewProcessedMessage[]) {
  if (rows.length === 0) return;

  const messageIds = rows.map((row) => row.messageId);

  await db.transaction(async (tx) => {
    await tx
      .insert(processedMessages)
      .values(rows)
      .onConflictDoUpdate({
        target: processedMessages.messageId,
        set: {
          data: sql`excluded.data`,
          processedAt: sql`excluded.processed_at`,
          status: sql`excluded.status`,
          warnings: sql`excluded.warnings`,
        },
      })
      .returning({ data: processedMessages.data });

    await tx
      .update(messages)
      .set({ isProcessed: true })
      .where(inArray(messages.id, messageIds));
  });
}

async function processParsedMessage(
  parsed: GreenApiParsedMessage,
  findCustomerByGeofenceName: CustomerGeofenceLookup,
): Promise<MessageWriteResult> {
  const customer = await findCustomerByGeofenceName(parsed.geofenceName);

  if (!customer) {
    return {
      success: false,
      message: `CUSTOMER_NOT_FOUND: ${parsed.geofenceName}`,
    };
  }

  const identity = {
    customerId: customer.id,
    messageId: parsed.messageId,
  };

  if (parsed.textMessage) {
    const messageType: 'update' | 'dispatch' | null = isUpdate(
      parsed.textMessage,
    )
      ? 'update'
      : isDispatchDetails(parsed.textMessage)
        ? 'dispatch'
        : null;

    if (!messageType) {
      return { success: false, message: 'Not an update or dispatch' };
    }

    const message = {
      ...identity,
      senderData: parsed.senderData,
      textMessage: parsed.textMessage,
      messageType,
    };

    if (parsed.action === 'create') return createMessage(message);
    if (parsed.action === 'edit') return editMessage(message);
  }

  return deleteMessage(identity);
}

export async function handleIncomingMessage(
  payload: unknown,
  findCustomerByGeofenceName: CustomerGeofenceLookup,
) {
  const parsed = parseGreenApiMessage(payload);
  if (parsed.status === 'invalid') return parsed;

  const result = await processParsedMessage(
    parsed.data,
    findCustomerByGeofenceName,
  );
  if (!result.success) {
    return { status: 'failed' as const, message: result.message };
  }

  return { status: 'processed' as const };
}

export async function processPendingMessages() {
  const pending = await db
    .select()
    .from(messages)
    .where(eq(messages.isProcessed, false))
    .orderBy(asc(messages.createdAt));

  if (pending.length === 0) {
    return { ok: 0, needs_review: 0, failed: 0, ignored: 0 };
  }

  const summary: Record<ProcessingOutcome, number> = {
    ok: 0,
    needs_review: 0,
    failed: 0,
    ignored: 0,
  };
  const rows: NewProcessedMessage[] = [];
  const skippedIds: string[] = [];

  for (const message of pending) {
    const parse =
      message.type === 'update'
        ? parseUpdate
        : message.type === 'dispatch'
          ? parseDispatchDetails
          : null;

    if (!parse) {
      summary.failed++;
      skippedIds.push(message.id);
      continue;
    }

    const row = rowFromMessage(message, parse);
    if (row) {
      rows.push(row);
      summary[row.status]++;
    } else {
      summary.ignored++;
      skippedIds.push(message.id);
    }
  }

  for (let i = 0; i < rows.length; i += 1000) {
    await saveProcessedMessages(rows.slice(i, i + 1000));
  }

  for (let i = 0; i < skippedIds.length; i += 1000) {
    await db
      .update(messages)
      .set({ isProcessed: true })
      .where(inArray(messages.id, skippedIds.slice(i, i + 1000)));
  }

  return summary;
}
