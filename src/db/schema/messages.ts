import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { customers } from './customers';
import { type GreenApiSenderData } from '@/services/messages/validator';

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  text: text('text').notNull(),
  metadata: jsonb('metadata').$type<GreenApiSenderData>().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Inferred TypeScript types for inserts and queries
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
