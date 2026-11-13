import { pgTable, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const aiConfigurations = pgTable('ai_configurations', {
  endpointUrl: varchar('endpoint_url', { length: 500 }).notNull(),
  provider: varchar('provider', { length: 100 }).notNull(),
  model: varchar('model', { length: 200 }).notNull(),
  encryptedApiKey: text('encrypted_api_key').notNull(),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
