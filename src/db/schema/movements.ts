import { 
  pgTable, 
  text, 
  boolean, 
  check, 
  uuid
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { movementStatusEnum, movementTypeEnum } from './enums';
import { trucks } from './trucks';
import { skids } from './skids';
import { customers } from './customers';


export const movements = pgTable('movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: movementTypeEnum('type').notNull(),
  status: movementStatusEnum('status').notNull().default('in_progress'),
  truckId: uuid('truck_id').references(() => trucks.id).notNull(),
  customerId: uuid('customer_station_id').references(() => customers.id),
  skidIdOut: uuid('skid_id_out').references(() => skids.id), 
  skidIdIn: uuid('skid_id_in').references(() => skids.id), 
  completed: boolean('completed').default(false).notNull(),
  note: text('note'),
}, (table) => [
  // Rule 1A: If type is 'dispatch', skidIdOut MUST NOT be null
  check(
    'chk_dispatch_requires_skid_out',
    sql`${table.type} != 'dispatch' 
    OR ${table.skidIdOut} IS NOT NULL`
  ),
  // Rule 1B: If type is 'dispatch', customer MUST NOT be null
  check(
    'chk_dispatch_requires_customer',
    sql`${table.type} != 'dispatch' 
    OR ${table.customerId} IS NOT NULL`
  ),

  // Rule 2: If type is 'dispatch' and completed is true, skidIdIn OR a non-empty note is required
  check(
    'chk_completed_dispatch_requires_skid_in_or_note',
    sql`${table.type} != 'dispatch' 
    OR NOT ${table.completed} 
    OR ${table.skidIdIn} IS NOT NULL
    OR (${table.note} IS NOT NULL AND TRIM(${table.note}) != '')`
  ),

  // Rule 3: If type is 'others' or 'service', note MUST NOT be null or empty
  check(
    'chk_others_or_service_requires_note',
    sql`${table.type} NOT IN ('others', 'service') OR (${table.note} IS NOT NULL AND TRIM(${table.note}) != '')`
  ),
]);


