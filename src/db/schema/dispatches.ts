import { pgTable, uuid, varchar, boolean } from 'drizzle-orm/pg-core';

export const dispatches = pgTable('dispatches', {
  id: uuid('id').primaryKey().defaultRandom(),
  truckId: uuid('truck_id').notNull(),
  skidIdOut: uuid('skid_id_out'),
  skidIdIn: uuid('skid_id_in'),
  customerStationId: uuid('customer_station_id'),
  completed: boolean('completed').default(false),
});

export type Dispatch = typeof dispatches.$inferSelect;
export type NewDispatch = typeof dispatches.$inferInsert;
