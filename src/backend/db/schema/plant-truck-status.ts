import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { trucks } from './trucks';

export const plantTruckStatuses = pgTable('plant_truck_statuses', {
  id: uuid('id').primaryKey().defaultRandom(),
  truckId: uuid('truck_id').notNull().unique().references(() => trucks.id, { onDelete: 'cascade' }),
  isStandby: boolean('is_standby').default(false).notNull(),
  isOnMaintenance: boolean('is_on_maintenance').default(false).notNull(),
  maintenanceNote: text('maintenance_note'),
  note: text('note'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type PlantTruckStatus = typeof plantTruckStatuses.$inferSelect;
