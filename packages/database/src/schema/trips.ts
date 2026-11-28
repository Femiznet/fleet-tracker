import {
  boolean,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tripDirectionEnum, tripStatusEnum } from './enums';
import { movements } from './movements';

export const trips = pgTable(
  'trips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    movementId: uuid('movement_id')
      .notNull()
      .references(() => movements.id, { onDelete: 'cascade' }),
    status: tripStatusEnum('status').notNull().default('in_transit'),
    direction: tripDirectionEnum('direction').notNull(),
    origin: varchar('origin', { length: 255 }).notNull(),
    destination: varchar('destination', { length: 255 }).notNull(),
    arrived: boolean('arrived').notNull().default(false),
    arrivedAt: timestamp('arrived_at', { withTimezone: true }),
  },
  (table) => [
    unique('unq_movement_direction').on(table.movementId, table.direction),
  ],
);

export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
