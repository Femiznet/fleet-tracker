import { pgTable, uuid, text, json, timestamp } from 'drizzle-orm/pg-core';
import { customer } from './customer';
import { processingStatus } from './enums';

export interface ProcessedTextData {
  name: string;
  flowRate: number;
  pressure: number;
}

export const customerUpdates = pgTable('customer_updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  customer_id: uuid('customer_id').notNull().references(() => customer.id),
  raw_text: text('raw_text').notNull(),
  processing_status: processingStatus("processing_status"),
  review_text: text('review_text'),
  processed_text: json('processed_text').$type<ProcessedTextData>(),  error_text: text('error_text'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});