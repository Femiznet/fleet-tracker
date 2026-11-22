import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { customers } from './customers';
import { type GreenApiSenderData } from '@/backend/services/messages/validator';
import { CustomerUpdateMessage } from '@/backend/services/messages/utils/updateParser';
import { messageTypeEnum } from './enums';
import { DispatchDetails } from '@/backend/services/messages/utils/dispatchParser';
import { movements } from './movements';

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: text('external_id').notNull().unique(),
  customerId: uuid('customer_id')
    .references(() => customers.id)
    .notNull(),
  text: text('text').notNull(),
  metadata: jsonb('metadata').$type<GreenApiSenderData>().notNull(),
  type: messageTypeEnum('type').notNull(),
  isProcessed: boolean('is_processed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const processedMessages = pgTable(
  'processed_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // one parsed update per message; UNIQUE is what makes webhook retries harmless
    messageId: uuid('message_id')
      .references(() => messages.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    customerId: uuid('customer_id')
      .references(() => customers.id)
      .notNull(),
    status: text('status', { enum: ['ok', 'needs_review', 'failed'] }).notNull(),
    warnings: jsonb('warnings').$type<string[]>().notNull().default([]),
    data: jsonb('data').$type<CustomerUpdateMessage | DispatchDetails>(), // the clean JSON
    processedAt: timestamp('processed_at').defaultNow(),
    reviewStatus: text('review_status', {
      enum: ['pending', 'duplicate', 'approved', 'rejected'],
    }),
    dispatchFingerprint: text('dispatch_fingerprint'),
    duplicateOfMessageId: uuid('duplicate_of_message_id'),
    movementId: uuid('movement_id').references(() => movements.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    notificationDueAt: timestamp('notification_due_at', { withTimezone: true }),
    notificationText: text('notification_text'),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    notificationMessageId: text('notification_message_id'),
  },
  (table) => [
    uniqueIndex('unq_approved_dispatch_fingerprint')
      .on(table.dispatchFingerprint)
      .where(sql`${table.reviewStatus} = 'approved' AND ${table.dispatchFingerprint} IS NOT NULL`),
    uniqueIndex('unq_dispatch_notification_message_id')
      .on(table.notificationMessageId)
      .where(sql`${table.notificationMessageId} IS NOT NULL`),
  ]
);

// Inferred TypeScript types for inserts and queries
export type ProcessedMessage = typeof processedMessages.$inferSelect;
export type NewProcessedMessage = typeof processedMessages.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
