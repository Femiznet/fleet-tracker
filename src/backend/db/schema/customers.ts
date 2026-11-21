import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { customerType } from './enums';

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  geofenceName: varchar('geofence_name', { length: 100 }).unique(),
  location: varchar('location', { length: 255 }),
  type: customerType('customer_type').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type CustomerType = (typeof customerType.enumValues)[number];
