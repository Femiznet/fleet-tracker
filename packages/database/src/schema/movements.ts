import { sql } from 'drizzle-orm';
import { check, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { customers } from './customers';
import {
  movementStatusEnum,
  movementTypeEnum,
  trackingModeEnum,
} from './enums';
import { skids } from './skids';
import { trucks } from './trucks';

export const movements = pgTable(
  'movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: movementTypeEnum('type').notNull(),
    status: movementStatusEnum('status').notNull().default('in_progress'),
    trackingMode: trackingModeEnum('tracking_mode').notNull().default('live'),
    truckId: uuid('truck_id')
      .references(() => trucks.id)
      .notNull(),
    customerId: uuid('customer_id').references(() => customers.id),
    skidIdOut: uuid('skid_id_out').references(() => skids.id),
    skidIdIn: uuid('skid_id_in').references(() => skids.id),
    note: text('note'),
  },
  (table) => [
    uniqueIndex('unq_active_movement_per_truck')
      .on(table.truckId)
      .where(sql`${table.status} = 'in_progress'`),
    check(
      'chk_dispatch_requires_skid_out',
      sql`${table.type} != 'dispatch' OR ${table.skidIdOut} IS NOT NULL`,
    ),
    check(
      'chk_dispatch_requires_customer',
      sql`${table.type} != 'dispatch' OR ${table.customerId} IS NOT NULL`,
    ),
    check(
      'chk_completed_dispatch_requires_skid_in_or_note',
      sql`${table.type} != 'dispatch' OR ${table.status} != 'completed' OR ${table.skidIdIn} IS NOT NULL OR (${table.note} IS NOT NULL AND TRIM(${table.note}) != '')`,
    ),
    check(
      'chk_others_or_service_requires_note',
      sql`${table.type} NOT IN ('others', 'service') OR (${table.note} IS NOT NULL AND TRIM(${table.note}) != '')`,
    ),
  ],
);
