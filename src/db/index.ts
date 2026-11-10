import { drizzle } from 'drizzle-orm/node-postgres';
import { PgTransaction } from 'drizzle-orm/pg-core';
import { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

// Dynamically extract the specific Transaction type based on your db schema
export type DbTransaction = PgTransaction<
  NodePgQueryResultHKT, 
  Record<string, never>, // Swap with 'typeof schema' if using a relational schema
  Record<string, never>
>;

// Seamless db + transaction helper.
//
//   dbtx()        // normal queries against the connection pool
//   dbtx(tx)      // queries routed through a transaction (from db.transaction())
//
export function dbtx(tx?: DbTransaction) {
  return tx ?? db;
}
