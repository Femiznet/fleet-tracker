import { pgTable, uuid, varchar, doublePrecision, boolean, interval, timestamp } from 'drizzle-orm/pg-core';
import { customerType } from './enums';

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  location: varchar('location', { length: 255 }),
  type: customerType("customer_type"),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

// export const customerStations = pgTable('customer_stations', {
//   id: uuid('id').primaryKey().defaultRandom(),
//   customerId: uuid('customer_id').references(() => customers.id),
//   latitude: doublePrecision('latitude'),
//   longitude: doublePrecision('longitude'),
//   is_active: boolean('is_active').default(true),
//   relative_time: interval('relative_time'),
//   cutoff_pressure: doublePrecision('cutoff_pressure').default(0),
// });


// export interface ProcessedTextData {
//   name: string;
//   flowRate: number;
//   pressure: number;
// }

// export const customerUpdates = pgTable('customer_updates', {
//   id: uuid('id').primaryKey().defaultRandom(),
//   customer_id: uuid('customer_id').notNull().references(() => customers.id),
//   raw_text: text('raw_text').notNull(),
//   processing_status: processingStatus("processing_status"),
//   review_text: text('review_text'),
//   processed_text: json('processed_text').$type<ProcessedTextData>(),  error_text: text('error_text'),
//   created_at: timestamp('created_at').defaultNow(),
//   updated_at: timestamp('updated_at').defaultNow(),
// });


// export type CustomerUpdate = typeof customerUpdates.$inferSelect;
// export type NewCustomerUpdate = typeof customerUpdates.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type CustomerType = typeof customerType.enumValues[number];