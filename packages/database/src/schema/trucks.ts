import {
  doublePrecision,
  integer,
  pgTable,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { truckStatusEnum } from './enums';

export const trucks = pgTable('trucks', {
  id: uuid('id').primaryKey().defaultRandom(),
  truckNum: varchar('truck_num', { length: 100 }).notNull().unique(),
  slugNum: varchar('slug_num', { length: 100 }).unique(),
  lat: doublePrecision('lat').notNull(),
  lon: doublePrecision('lon').notNull(),
  currentLoc: varchar('current_loc', { length: 255 })
    .notNull()
    .default('pending'),
  speed: integer('speed').notNull(),
  status: truckStatusEnum('status').notNull().default('available'),
});

export type Truck = typeof trucks.$inferSelect;
export type NewTruck = typeof trucks.$inferInsert;
