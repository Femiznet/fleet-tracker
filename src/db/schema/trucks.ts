import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

export const trucks = pgTable('trucks', {
  id: uuid('id').primaryKey().defaultRandom(),
  platenumber: varchar('platenumber', { length: 100 }).notNull(),
  slug_num: varchar('slug_num', { length: 100 }).notNull(),
});

export type Truck = typeof trucks.$inferSelect;
export type NewTruck = typeof trucks.$inferInsert;
