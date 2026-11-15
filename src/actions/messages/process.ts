import { asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { messages, processedMessages, type Message, type NewProcessedMessage } from '@/db/schema/messages';
import { parseUpdate } from '@/services/messages/utils/parser';

export type Outcome = 'ok' | 'needs_review' | 'failed' | 'ignored';

/** Parse one message in memory. null = not an update, nothing to store. */
function toRow(message: Message, parse: typeof parseUpdate): NewProcessedMessage | null {
  try {
    const result = parse(message.text);
    if (result.kind === 'ignored') return null;
    return {
      messageId: message.id,
      customerId: message.customerId,
      status: result.status,
      warnings: result.warnings,
      data: result.data,
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

const save = (rows: NewProcessedMessage[]) =>
  db.insert(processedMessages).values(rows).onConflictDoNothing({ target: processedMessages.messageId });

/** Process ONE message (e.g. right after inserting it). */
export async function processOne(message: Message, parse: typeof parseUpdate = parseUpdate): Promise<Outcome> {
  const row = toRow(message, parse);
  if (!row) return 'ignored';
  await save([row]);
  return row.status;
}

/** Process every message that has no processed_messages row yet. */
export async function processPendingMessages(parse: typeof parseUpdate = parseUpdate) {
  const pending = await db
    .select({ message: messages })
    .from(messages)
    .leftJoin(processedMessages, eq(processedMessages.messageId, messages.id))
    .where(isNull(processedMessages.id))
    .orderBy(asc(messages.createdAt));

  // 1. parse everything in memory (fast, no database involved)
  const summary: Record<Outcome, number> = { ok: 0, needs_review: 0, failed: 0, ignored: 0 };
  const rows: NewProcessedMessage[] = [];
  for (const { message } of pending) {
    const row = toRow(message, parse);
    if (row) { rows.push(row); summary[row.status]++; }
    else summary.ignored++;
  }

  // 2. write to the database in big batches instead of one insert per message
  //    (Postgres caps a single query at 65,535 values, so a huge backlog is chunked)
  for (let i = 0; i < rows.length; i += 1000) await save(rows.slice(i, i + 1000));

  return summary;
}