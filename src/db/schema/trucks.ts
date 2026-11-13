import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

export const trucks = pgTable('trucks', {
  id: uuid('id').primaryKey().defaultRandom(),
  plateNumber: varchar('plate_number', { length: 100 }).notNull().unique(),
  slugNum: varchar('slug_num', { length: 100 }).notNull().unique(),
});

export type Truck = typeof trucks.$inferSelect;
export type NewTruck = typeof trucks.$inferInsert;
