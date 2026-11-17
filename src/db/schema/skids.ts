import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { skidStatusEnum } from './enums';

export const skids = pgTable('skids', {
  id: uuid('id').primaryKey().defaultRandom(),
  skidNum: varchar('skid_num', { length: 100 }).notNull().unique(),
  slugNum: varchar('slug_num', { length: 100 }).unique(),
  currentLoc: varchar('current_loc', { length: 255 }).notNull().default('pending'),
  status: skidStatusEnum('status').notNull().default('available'),
});

export type Skid = typeof skids.$inferSelect;
export type NewSkid = typeof skids.$inferInsert;
