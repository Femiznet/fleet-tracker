import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

export const skids = pgTable('skids', {
  id: uuid('id').primaryKey().defaultRandom(),
  skid_num: varchar('skid_num', { length: 100 }).notNull(),
  slug_num: varchar('slug_num', { length: 100 }).notNull(),
});

export type Skid = typeof skids.$inferSelect;
export type NewSkid = typeof skids.$inferInsert;
