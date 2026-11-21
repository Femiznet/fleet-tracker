import { and, desc, eq, ilike, ne, sql } from 'drizzle-orm';
import { db } from '@/backend/db';
import { customers, messages, processedMessages, skids, trucks } from '@/backend/db/schema';
import { createDispatch } from '@/backend/services/dispatch';
import {
  DispatchDetailsSchema,
  type DispatchDetails,
} from '@/backend/services/messages/utils/dispatchParser';
import {
  createDispatchFingerprint,
  formatDispatchNotification,
  matchesDispatchNotification,
} from '@/backend/services/messages/dispatch-review';
import { ALLOWED_MESSAGE_LISTS } from '@/backend/services/messages/config';

export class DispatchReviewError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message);
  }
}

export async function listMessages(input: {
  page: number;
  limit: number;
  type?: 'update' | 'dispatch';
  reviewStatus?: 'pending' | 'duplicate' | 'approved' | 'rejected';
}) {
  const offset = (input.page - 1) * input.limit;
  const filters = [
    input.type ? eq(messages.type, input.type) : undefined,
    input.reviewStatus ? eq(processedMessages.reviewStatus, input.reviewStatus) : undefined,
  ].filter((filter): filter is NonNullable<typeof filter> => filter !== undefined);
  const where = filters.length ? and(...filters) : undefined;

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: messages.id,
        externalId: messages.externalId,
        customerId: messages.customerId,
        customerName: customers.name,
        text: messages.text,
        type: messages.type,
        metadata: messages.metadata,
        createdAt: messages.createdAt,
        isProcessed: messages.isProcessed,
        processingStatus: processedMessages.status,
        warnings: processedMessages.warnings,
        parsedData: processedMessages.data,
        reviewStatus: processedMessages.reviewStatus,
        duplicateOfMessageId: processedMessages.duplicateOfMessageId,
        movementId: processedMessages.movementId,
      })
      .from(messages)
      .innerJoin(customers, eq(messages.customerId, customers.id))
      .leftJoin(processedMessages, eq(processedMessages.messageId, messages.id))
      .where(where)
      .orderBy(desc(messages.createdAt))
      .limit(input.limit)
      .offset(offset),
    db
      .select({ value: sql<number>`count(*)` })
      .from(messages)
      .leftJoin(processedMessages, eq(processedMessages.messageId, messages.id))
      .where(where),
  ]);

  return { rows, total: Number(countRows[0]?.value ?? 0) };
}

export async function approveDispatchMessage(
  messageId: string,
  overrides: Partial<DispatchDetails> = {}
) {
  let targetFingerprint: string | null = null;

  try {
    return await db.transaction(async (tx) => {
      const [review] = await tx
        .select()
        .from(processedMessages)
        .where(eq(processedMessages.messageId, messageId))
        .for('update');

      if (!review) {
        throw new DispatchReviewError('Processed dispatch message not found', 'NOT_FOUND', 404);
      }
      if (review.reviewStatus !== 'pending') {
        throw new DispatchReviewError(
          `Dispatch message cannot be approved from status ${review.reviewStatus ?? 'unavailable'}`,
          'INVALID_REVIEW_STATUS',
          409
        );
      }

      const [message] = await tx
        .select({ customerId: messages.customerId })
        .from(messages)
        .where(eq(messages.id, messageId));
      if (!message) {
        throw new DispatchReviewError('Dispatch message not found', 'NOT_FOUND', 404);
      }

      const parsed = DispatchDetailsSchema.safeParse(review.data);
      if (!parsed.success) {
        throw new DispatchReviewError('Parsed dispatch details are invalid', 'INVALID_DISPATCH_DATA', 422);
      }

      const detailsResult = DispatchDetailsSchema.safeParse({
        ...parsed.data,
        ...overrides,
      });
      if (!detailsResult.success) {
        throw new DispatchReviewError('Dispatch details are invalid', 'INVALID_DISPATCH_DATA', 400);
      }
      const details = detailsResult.data;
      if (!details.truckNumber || !details.skidNumber || !details.dateOut) {
        throw new DispatchReviewError(
          'Truck number, skid number, and dispatch date are required',
          'MISSING_DUPLICATE_CHECK_FIELDS',
          422
        );
      }

      const fingerprint = createDispatchFingerprint(message.customerId, details);
      if (fingerprint === null) {
        throw new DispatchReviewError(
          'Truck number, skid number, and dispatch date are required',
          'MISSING_DUPLICATE_CHECK_FIELDS',
          422
        );
      }
      targetFingerprint = fingerprint;

      const [existingApproved] = await tx
        .select({ messageId: processedMessages.messageId })
        .from(processedMessages)
        .where(and(
          eq(processedMessages.dispatchFingerprint, fingerprint),
          eq(processedMessages.reviewStatus, 'approved'),
          ne(processedMessages.messageId, messageId)
        ))
        .limit(1);
      if (existingApproved) {
        await tx
          .update(processedMessages)
          .set({
            reviewStatus: 'duplicate',
            duplicateOfMessageId: existingApproved.messageId,
            dispatchFingerprint: fingerprint,
            data: details,
          })
          .where(eq(processedMessages.messageId, messageId));
        return { status: 'duplicate' as const, duplicateOfMessageId: existingApproved.messageId };
      }

      const [truck] = await tx
        .select({ id: trucks.id })
        .from(trucks)
        .where(ilike(trucks.truckNum, details.truckNumber))
        .limit(1);
      if (!truck) {
        throw new DispatchReviewError(`Truck ${details.truckNumber} was not found`, 'TRUCK_NOT_FOUND', 422);
      }

      const [skid] = await tx
        .select({ id: skids.id })
        .from(skids)
        .where(ilike(skids.skidNum, details.skidNumber))
        .limit(1);
      if (!skid) {
        throw new DispatchReviewError(`Skid ${details.skidNumber} was not found`, 'SKID_NOT_FOUND', 422);
      }

      const movementId = await createDispatch({
        truckId: truck.id,
        customerId: message.customerId,
        skidIdOut: skid.id,
      }, tx);

      const approvedAt = new Date();
      await tx
        .update(processedMessages)
        .set({
          reviewStatus: 'approved',
          dispatchFingerprint: fingerprint,
          duplicateOfMessageId: null,
          movementId,
          approvedAt,
          notificationDueAt: new Date(approvedAt.getTime() + 10 * 60 * 1000),
          notificationText: formatDispatchNotification(details),
          notifiedAt: null,
          notificationMessageId: null,
          data: details,
        })
        .where(eq(processedMessages.messageId, messageId));

      return {
        status: 'approved' as const,
        movementId,
        notificationDueAt: new Date(approvedAt.getTime() + 10 * 60 * 1000),
        notificationText: formatDispatchNotification(details),
      };
    });
  } catch (error) {
    if (error instanceof DispatchReviewError) throw error;

    let existingApproved: { messageId: string } | undefined;
    if (targetFingerprint) {
      const [approved] = await db
      .select({ messageId: processedMessages.messageId })
      .from(processedMessages)
      .where(and(
        eq(processedMessages.dispatchFingerprint, targetFingerprint),
        eq(processedMessages.reviewStatus, 'approved'),
        ne(processedMessages.messageId, messageId)
      ))
      .limit(1);
      existingApproved = approved;
    }

    if (existingApproved) {
      await db
        .update(processedMessages)
        .set({
          reviewStatus: 'duplicate',
          duplicateOfMessageId: existingApproved.messageId,
        })
        .where(and(
          eq(processedMessages.messageId, messageId),
          eq(processedMessages.reviewStatus, 'pending')
        ));
      return { status: 'duplicate' as const, duplicateOfMessageId: existingApproved.messageId };
    }

    throw error;
  }
}

export async function rejectDispatchMessage(messageId: string) {
  const [review] = await db
    .update(processedMessages)
    .set({ reviewStatus: 'rejected' })
    .where(and(
      eq(processedMessages.messageId, messageId),
      eq(processedMessages.reviewStatus, 'pending')
    ))
    .returning({ messageId: processedMessages.messageId });

  if (!review) {
    throw new DispatchReviewError(
      'Dispatch message not found or is no longer pending review',
      'INVALID_REVIEW_STATUS',
      409
    );
  }

  return { status: 'rejected' as const };
}

export async function listDispatchNotifications(overdueOnly = false) {
  const now = new Date();
  const filters = [
    eq(processedMessages.reviewStatus, 'approved'),
    sql`${processedMessages.notifiedAt} IS NULL`,
    sql`${processedMessages.notificationDueAt} IS NOT NULL`,
    overdueOnly ? sql`${processedMessages.notificationDueAt} <= ${now}` : undefined,
  ].filter((filter): filter is NonNullable<typeof filter> => filter !== undefined);

  return db
    .select({
      messageId: processedMessages.messageId,
      movementId: processedMessages.movementId,
      customerId: messages.customerId,
      customerName: customers.name,
      notificationText: processedMessages.notificationText,
      approvedAt: processedMessages.approvedAt,
      dueAt: processedMessages.notificationDueAt,
    })
    .from(processedMessages)
    .innerJoin(messages, eq(messages.id, processedMessages.messageId))
    .innerJoin(customers, eq(customers.id, messages.customerId))
    .where(and(...filters))
    .orderBy(processedMessages.notificationDueAt)
    .then((rows) => rows.map((row) => ({
      ...row,
      overdue: row.dueAt !== null && row.dueAt <= now,
    })));
}

export async function recordDispatchNotification(input: {
  chatId: string;
  messageId: string;
  sentAt: Date;
  text: string;
}) {
  const geofenceName = ALLOWED_MESSAGE_LISTS[input.chatId];
  if (!geofenceName) return false;

  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.geofenceName, geofenceName))
    .limit(1);
  if (!customer) return false;

  const candidates = await db
    .select({
      messageId: processedMessages.messageId,
      data: processedMessages.data,
      approvedAt: processedMessages.approvedAt,
    })
    .from(processedMessages)
    .innerJoin(messages, eq(messages.id, processedMessages.messageId))
    .where(and(
      eq(messages.customerId, customer.id),
      eq(processedMessages.reviewStatus, 'approved'),
      sql`${processedMessages.notifiedAt} IS NULL`,
      sql`${processedMessages.approvedAt} <= ${input.sentAt}`
    ))
    .orderBy(processedMessages.approvedAt);

  for (const candidate of candidates) {
    const parsed = DispatchDetailsSchema.safeParse(candidate.data);
    if (!parsed.success || !matchesDispatchNotification(input.text, parsed.data)) continue;

    const [updated] = await db
      .update(processedMessages)
      .set({
        notifiedAt: input.sentAt,
        notificationMessageId: input.messageId,
      })
      .where(and(
        eq(processedMessages.messageId, candidate.messageId),
        eq(processedMessages.reviewStatus, 'approved'),
        sql`${processedMessages.notifiedAt} IS NULL`
      ))
      .returning({ messageId: processedMessages.messageId });

    if (updated) return true;
  }

  return false;
}
