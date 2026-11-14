import { boolean, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

export const trucks = pgTable('trucks', {
  id: uuid('id').primaryKey().defaultRandom(),
  truckNum: varchar('truck_num', { length: 100 }).notNull().unique(),
  slugNum: varchar('slug_num', { length: 100 }).notNull().unique(),
  currentTruckLoc: varchar('current_truck_loc', { length: 255 }).notNull(),
  inMaintenance: boolean('in_maintenance').default(false).notNull()
});

export type Truck = typeof trucks.$inferSelect;
export type NewTruck = typeof trucks.$inferInsert;
