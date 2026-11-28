import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function dbtx(tx?: DbTransaction) {
  return tx ?? db;
}
