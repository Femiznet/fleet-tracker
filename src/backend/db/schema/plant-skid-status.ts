import { boolean, check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { skids } from './skids';
import { skidBayEnum, skidFillStateEnum } from './enums';

export const plantSkidStatuses = pgTable('plant_skid_statuses', {
  id: uuid('id').primaryKey().defaultRandom(),
  skidId: uuid('skid_id').notNull().unique().references(() => skids.id, { onDelete: 'cascade' }),
  fillState: skidFillStateEnum('fill_state').notNull().default('empty'),
  bay: skidBayEnum('bay').notNull().default('parking_bay'),
  isOnMaintenance: boolean('is_on_maintenance').default(false).notNull(),
  maintenanceNote: text('maintenance_note'),
  note: text('note'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  check(
    'plant_skid_status_loading_bay',
    sql`${table.fillState} <> 'loading' OR ${table.bay} = 'loading_bay'`
  ),
]);

export type PlantSkidStatus = typeof plantSkidStatuses.$inferSelect;
