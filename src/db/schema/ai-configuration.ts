import { pgTable, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const aiConfigurations = pgTable('ai_configurations', {
  endpoint_url: varchar('endpoint_url', { length: 500 }).notNull(),
  provider: varchar('provider', { length: 100 }).notNull(),
  model: varchar('model', { length: 200 }).notNull(),
  encrypted_api_key: text('encrypted_api_key').notNull(),
  active: boolean('active').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});
