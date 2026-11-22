import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

// Dynamically extract the specific Transaction type based on your db schema
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Seamless db + transaction helper.
//
//   dbtx()        // normal queries against the connection pool
//   dbtx(tx)      // queries routed through a transaction (from db.transaction())
//
export function dbtx(tx?: DbTransaction) {
  return tx ?? db;
}
