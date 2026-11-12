import { pgTable, uuid, varchar, doublePrecision, boolean, interval, timestamp } from 'drizzle-orm/pg-core';
import { customerType } from './enums';

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  type: customerType("customer_type"),
  is_active: boolean('is_active').default(true),
  relative_time: interval('relative_time'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  cutoff_pressure: doublePrecision('cutoff_pressure').default(0),
});


export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type CustomerType = typeof customerType.enumValues[number];