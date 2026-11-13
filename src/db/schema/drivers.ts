import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { trucks } from './trucks';

export const drivers = pgTable('drivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 255 }).unique(),
  currentTruck: varchar('current_truck', { length: 20 }).references(() => trucks.truckNum).unique(),
});

export type Driver = typeof drivers.$inferSelect;
export type NewDriver = typeof drivers.$inferInsert;

