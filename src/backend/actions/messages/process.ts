import { and, asc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { db } from '@/backend/db';
import {
  messages,
  processedMessages,
  type Message,
  type NewProcessedMessage,
} from '@/backend/db/schema/messages';
import { parseUpdate } from '@/backend/services/messages/utils/updateParser';
import {
  DispatchDetailsSchema,
  parseDispatchDetails,
} from '@/backend/services/messages/utils/dispatchParser';
import { createDispatchFingerprint } from '@/backend/services/messages/dispatch-review';

export type Outcome = 'ok' | 'needs_review' | 'failed' | 'ignored';

/** Parse one message in memory. null = not an update, nothing to store. */
function toRow(
  message: Message,
  parse: typeof parseUpdate | typeof parseDispatchDetails
): NewProcessedMessage | null {
  try {
    const result = parse(message.text);
    return {
      messageId: message.id,
      customerId: message.customerId,
      status: result.status,
      warnings: result.warnings,
      data: result.data,
      reviewStatus: message.type === 'dispatch' ? 'pending' : null,
      dispatchFingerprint:
        message.type === 'dispatch'
          ? (() => {
              const parsedDetails = DispatchDetailsSchema.safeParse(result.data);
              return parsedDetails.success
                ? createDispatchFingerprint(message.customerId, parsedDetails.data)
                : null;
            })()
          : null,
      duplicateOfMessageId: null,
    };
  } catch (err) {
    return {
      messageId: message.id,
      customerId: message.customerId,
      status: 'failed',
      warnings: [err instanceof Error ? err.message : String(err)],
      data: null,
    };
  }
}

const save = async (rows: NewProcessedMessage[]) => {
  if (rows.length === 0) return;

  await db.transaction(async (tx) => {
    for (const row of rows) {
      let rowToSave = row;

      if (row.reviewStatus === 'pending' && row.dispatchFingerprint) {
        const [duplicate] = await tx
          .select({ messageId: processedMessages.messageId })
          .from(processedMessages)
          .where(
            and(
              eq(processedMessages.dispatchFingerprint, row.dispatchFingerprint),
              ne(processedMessages.messageId, row.messageId),
              or(
                eq(processedMessages.reviewStatus, 'pending'),
                eq(processedMessages.reviewStatus, 'approved')
              )
            )
          )
          .limit(1);

        if (duplicate) {
          rowToSave = {
            ...row,
            reviewStatus: 'duplicate',
            duplicateOfMessageId: duplicate.messageId,
          };
        }
      }

      await tx
        .insert(processedMessages)
        .values(rowToSave)
        .onConflictDoUpdate({
          target: processedMessages.messageId,
          set: {
            data: sql`excluded.data`,
            processedAt: sql`excluded.processed_at`,
            status: sql`excluded.status`,
            warnings: sql`excluded.warnings`,
            reviewStatus: sql`excluded.review_status`,
            dispatchFingerprint: sql`excluded.dispatch_fingerprint`,
            duplicateOfMessageId: sql`excluded.duplicate_of_message_id`,
          },
        });

      await tx.update(messages).set({ isProcessed: true }).where(eq(messages.id, row.messageId));
    }
  });
};

/** Process ONE message (e.g. right after inserting it). */
export async function processOne(message: Message): Promise<Outcome> {
  let parse: typeof parseUpdate | typeof parseDispatchDetails;

  if (message.type === 'update') {
    parse = parseUpdate;
  } else if (message.type === 'dispatch') {
    parse = parseDispatchDetails;
  } else return 'ignored';

  const row = toRow(message, parse);
  if (!row) return 'ignored';
  await save([row]);
  return row.status;
}

/** Process every message that has no processed_messages row yet. */
export async function processPendingMessages() {
  const pending = await db
    .select()
    .from(messages)
    .where(eq(messages.isProcessed, false))
    .orderBy(asc(messages.createdAt));

  if (pending.length === 0) {
    return { ok: 0, needs_review: 0, failed: 0, ignored: 0 };
  }

  const summary: Record<Outcome, number> = { ok: 0, needs_review: 0, failed: 0, ignored: 0 };
  const rows: NewProcessedMessage[] = [];
  const skippedIds: string[] = [];

  for (const message of pending) {
    let parse: typeof parseUpdate | typeof parseDispatchDetails;

    if (message.type === 'update') {
      parse = parseUpdate;
    } else if (message.type === 'dispatch') {
      parse = parseDispatchDetails;
    } else {
      summary.failed++;
      skippedIds.push(message.id);
      continue;
    }

    const row = toRow(message, parse);
    if (row) {
      rows.push(row);
      summary[row.status]++;
    } else {
      summary.ignored++;
      skippedIds.push(message.id);
    }
  }

  for (let i = 0; i < rows.length; i += 1000) {
    await save(rows.slice(i, i + 1000));
  }

  // Mark ignored and unknown-type messages as processed so they don't loop forever
  for (let i = 0; i < skippedIds.length; i += 1000) {
    await db
      .update(messages)
      .set({ isProcessed: true })
      .where(inArray(messages.id, skippedIds.slice(i, i + 1000)));
  }

  return summary;
}
