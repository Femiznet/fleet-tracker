import { boolean, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

export const skids = pgTable('skids', {
  id: uuid('id').primaryKey().defaultRandom(),
  skidNum: varchar('skid_num', { length: 100 }).notNull().unique(),
  slugNum: varchar('slug_num', { length: 100 }).unique(),
  currentLoc: varchar('current_loc', { length: 255 }).notNull().default('pending'),
  inMaintenance: boolean('in_maintenance').default(false).notNull()
});

export type Skid = typeof skids.$inferSelect;
export type NewSkid = typeof skids.$inferInsert;
