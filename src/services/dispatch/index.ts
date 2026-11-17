import { db } from '@/db';
import { sql } from 'drizzle-orm';

export interface CreateDispatchInput {
  truckId: string;
  customerId: string;
  skidIdOut: string;
  note?: string | null;
  forceOverride?: boolean;
}

export interface CompleteDispatchInput {
  movementId: string;
  skidIdIn?: string | null;
  note?: string | null;
  forceOverride?: boolean;
}

export interface CancelDispatchInput {
  movementId: string;
  note?: string | null;
}

/**
 * Helper to extract clean error messages thrown by PostgreSQL RAISE EXCEPTION
 */
function formatPostgresError(error: unknown): Error {
  if (error && typeof error === 'object') {
    const pgError = error as { message?: string; cause?: { message?: string } };
    const cleanMessage = pgError.cause?.message || pgError.message;
    if (cleanMessage) {
      return new Error(cleanMessage);
    }
  }
  return new Error('An unexpected database error occurred');
}

/**
 * 1. Create a new dispatch movement
 */
export async function createDispatch(input: CreateDispatchInput): Promise<string> {
  try {
    const result = await db.execute<{ movement_id: string }>(sql`
      SELECT create_dispatch(
        ${input.truckId}::uuid,
        ${input.customerId}::uuid,
        ${input.skidIdOut}::uuid,
        ${input.note ?? null}::text,
        ${input.forceOverride ?? false}::boolean
      ) AS movement_id
    `);

    // Note: Depending on your Drizzle driver (node-postgres vs postgres.js),
    // rows may be on `result.rows[0]` or `result[0]`
    const rows = Array.isArray(result) ? result : result.rows;
    return rows[0].movement_id;
  } catch (error) {
    throw formatPostgresError(error);
  }
}

/**
 * 2. Complete an active roundtrip dispatch
 */
export async function completeDispatch(input: CompleteDispatchInput): Promise<void> {
  try {
    await db.execute(sql`
      SELECT complete_dispatch(
        ${input.movementId}::uuid,
        ${input.skidIdIn ?? null}::uuid,
        ${input.note ?? null}::text,
        ${input.forceOverride ?? false}::boolean
      )
    `);
  } catch (error) {
    throw formatPostgresError(error);
  }
}

/**
 * 3. Cancel an in-progress dispatch and reset truck/skid statuses
 */
export async function cancelDispatch(input: CancelDispatchInput): Promise<void> {
  try {
    await db.execute(sql`
      SELECT cancel_dispatch(
        ${input.movementId}::uuid,
        ${input.note ?? null}::text
      )
    `);
  } catch (error) {
    throw formatPostgresError(error);
  }
}
