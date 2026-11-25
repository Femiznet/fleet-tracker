import { sql } from 'drizzle-orm';
import { boolean, check, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { skidStatusEnum, skidStateEnum } from './enums';
import { customers } from './customers';

export const skids = pgTable('skids', {
  id: uuid('id').primaryKey().defaultRandom(),
  skidNum: varchar('skid_num', { length: 100 }).notNull().unique(),
  slugNum: varchar('slug_num', { length: 100 }).unique(),
  customerId: uuid('customer_id').references(() => customers.id), // NULL = Gastech skid
  currentLoc: varchar('current_loc', { length: 255 }).notNull().default('pending'),
  status: skidStatusEnum('status').notNull().default('available'),
  state: skidStateEnum('state').notNull().default('empty'),
  isForWashing: boolean('is_for_washing').notNull().default(false),
  isNew: boolean('is_new').default(false).notNull(), // Tagged on registration for newly acquired skids
}, (table) => [
  check(
    'skids_is_for_washing_state_check',
    sql`NOT ${table.isForWashing} OR ${table.state} IN ('empty', 'loaded')`
  ),
]);


export type Skid = typeof skids.$inferSelect;
export type NewSkid = typeof skids.$inferInsert;
