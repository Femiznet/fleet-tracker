import { pgTable, uuid, varchar, boolean } from 'drizzle-orm/pg-core';
import { direction } from './enums';

export const trips = pgTable('trips', {
  id: uuid('id').primaryKey().defaultRandom(),
  dispatchId: uuid('dispatch_id').notNull(),
  origin: varchar('origin', { length: 255 }),
  current: varchar('current', { length: 255 }),
  destination: varchar('destination', { length: 255 }),
  direction: direction('direction').notNull(),
  arrived: boolean('arrived').default(false),
});

export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
