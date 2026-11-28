import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { customers } from './customers';
import { customerSkidLoadingStateEnum } from './enums';

export const customerSkidLoadings = pgTable(
  'customer_skid_loadings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    skidNum: varchar('skid_num', { length: 100 }).notNull(),
    state: customerSkidLoadingStateEnum('state').notNull().default('empty'),
    isForWashing: boolean('is_for_washing').notNull().default(false),
    arrivedAt: timestamp('arrived_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    loadedAt: timestamp('loaded_at', { withTimezone: true }),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'customer_skid_loading_number_not_empty',
      sql`btrim(${table.skidNum}) <> ''`,
    ),
    check(
      'customer_skid_loading_dispatch_requires_loaded',
      sql`${table.dispatchedAt} IS NULL OR ${table.state} = 'loaded'`,
    ),
    check(
      'customer_skid_loading_washing_requires_empty_or_loaded',
      sql`NOT ${table.isForWashing} OR ${table.state} IN ('empty', 'loaded')`,
    ),
    uniqueIndex('unq_active_customer_skid_loading')
      .on(sql`lower(btrim(${table.skidNum}))`)
      .where(sql`${table.dispatchedAt} IS NULL`),
    index('customer_skid_loadings_dispatched_at_idx').on(table.dispatchedAt),
    index('customer_skid_loadings_customer_id_idx').on(table.customerId),
  ],
);

export type CustomerSkidLoading = typeof customerSkidLoadings.$inferSelect;
export type NewCustomerSkidLoading = typeof customerSkidLoadings.$inferInsert;
