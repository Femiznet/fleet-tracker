import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { drivers } from './drivers';

export const motormates = pgTable('motormates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).unique().notNull(),
  phone: varchar('phone', { length: 255 }).unique(),
  currentDriver: varchar('current_driver', { length: 255 }).references(() => drivers.name).unique()
});

export type Motormate = typeof motormates.$inferSelect;
export type NewMotormate = typeof motormates.$inferInsert;
