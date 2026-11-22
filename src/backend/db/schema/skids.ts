import { boolean, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { skidStatusEnum, skidOwnerEnum } from './enums';
import { customers } from './customers';

export const skids = pgTable('skids', {
  id: uuid('id').primaryKey().defaultRandom(),
  skidNum: varchar('skid_num', { length: 100 }).notNull().unique(),
  slugNum: varchar('slug_num', { length: 100 }).unique(),
  customerId: uuid('customer_id').references(() => customers.id), // NULL = Gastech skid
  currentLoc: varchar('current_loc', { length: 255 }).notNull().default('pending'),
  status: skidStatusEnum('status').notNull().default('available'),
  owner: skidOwnerEnum('owner').notNull().default('gastech'),
  isNew: boolean('is_new').default(false).notNull(), // Tagged on registration for newly acquired skids
});

export type Skid = typeof skids.$inferSelect;
export type NewSkid = typeof skids.$inferInsert;
