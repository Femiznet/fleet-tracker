import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { customers } from './customers';
import { type GreenApiSenderData } from '@/services/messages/validator';
import { CustomerUpdateMessage } from '@/services/messages/utils/updateParser';
import { messageTypeEnum } from './enums';
import { DispatchDetails } from '@/services/messages/utils/dispatchParser';

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: text('external_id').notNull().unique(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  text: text('text').notNull(),
  metadata: jsonb('metadata').$type<GreenApiSenderData>().notNull(),
  type: messageTypeEnum('type').notNull(),
  isProcessed: boolean('is_processed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});


export const processedMessages = pgTable('processed_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  // one parsed update per message; UNIQUE is what makes webhook retries harmless
  messageId: uuid('message_id').references(() => messages.id).notNull().unique(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  status: text('status', { enum: ['ok', 'needs_review', 'failed'] }).notNull(),
  warnings: jsonb('warnings').$type<string[]>().notNull().default([]),
  data: jsonb('data').$type<CustomerUpdateMessage | DispatchDetails>(), // the clean JSON
  processedAt: timestamp('processed_at').defaultNow(),
  },
);

// Inferred TypeScript types for inserts and queries
export type ProcessedMessage = typeof processedMessages.$inferSelect;
export type NewProcessedMessage = typeof processedMessages.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
