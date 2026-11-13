import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

export const motormates = pgTable('motormates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 255 }),
});

export type Motormate = typeof motormates.$inferSelect;
export type NewMotormate = typeof motormates.$inferInsert;
