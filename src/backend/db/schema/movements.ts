import { pgTable, uuid, text, check, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { movementTypeEnum, movementStatusEnum } from './enums';
import { trucks } from './trucks';
import { customers } from './customers';
import { skids } from './skids';

export const movements = pgTable(
  'movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: movementTypeEnum('type').notNull(),
    status: movementStatusEnum('status').notNull().default('in_progress'),
    truckId: uuid('truck_id')
      .references(() => trucks.id)
      .notNull(),
    customerId: uuid('customer_id').references(() => customers.id),
    skidIdOut: uuid('skid_id_out').references(() => skids.id),
    skidIdIn: uuid('skid_id_in').references(() => skids.id),
    note: text('note'),
  },
  (table) => [
    // Partial Unique Index: A truck can only have ONE 'in_progress' movement at a time
    uniqueIndex('unq_active_movement_per_truck')
      .on(table.truckId)
      .where(sql`${table.status} = 'in_progress'`),

    // Rule 1A: If type is 'dispatch', skidIdOut MUST NOT be null
    check(
      'chk_dispatch_requires_skid_out',
      sql`${table.type} != 'dispatch' OR ${table.skidIdOut} IS NOT NULL`
    ),
    // Rule 1B: If type is 'dispatch', customer MUST NOT be null
    check(
      'chk_dispatch_requires_customer',
      sql`${table.type} != 'dispatch' OR ${table.customerId} IS NOT NULL`
    ),
    // Rule 2: If type is 'dispatch' and status is 'completed', skidIdIn OR a non-empty note is required
    check(
      'chk_completed_dispatch_requires_skid_in_or_note',
      sql`${table.type} != 'dispatch' OR ${table.status} != 'completed' OR ${table.skidIdIn} IS NOT NULL OR (${table.note} IS NOT NULL AND TRIM(${table.note}) != '')`
    ),
    // Rule 3: If type is 'others' or 'service', note MUST NOT be null or empty
    check(
      'chk_others_or_service_requires_note',
      sql`${table.type} NOT IN ('others', 'service') OR (${table.note} IS NOT NULL AND TRIM(${table.note}) != '')`
    ),
  ]
);

export type Movement = typeof movements.$inferSelect;
export type NewMovement = typeof movements.$inferInsert;
