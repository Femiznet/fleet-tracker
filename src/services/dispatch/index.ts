import { db } from '@/db';
import { formatDbError } from '@/lib/errors';
import { sql } from 'drizzle-orm';

export interface CreateDispatchInput {
  truckId: string;
  customerId: string;
  skidIdOut: string;
  note?: string | null;
  forceOverride?: boolean;
}

export interface CreatePickupInput {
  truckId: string;
  customerId: string;
  skidIdIn?: string | null;
  note?: string | null;
  forceOverride?: boolean;
}

export interface CompleteMovementInput {
  movementId: string;
  skidIdIn?: string | null;
  note?: string | null;
  forceOverride?: boolean;
}

export interface CancelMovementInput {
  movementId: string;
  note?: string | null;
}



/**
 * 1. Create a new full roundtrip dispatch (GASTECH PLANT -> Customer -> GASTECH PLANT)
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

    const rows = Array.isArray(result) ? result : result.rows;
    const movementId = rows[0]?.movement_id;

    if (!movementId) {
      throw new Error('Failed to retrieve movement ID from database');
    }

    return movementId;

  } catch (error) {
    throw formatDbError(error);
  }
}

/**
 * 2. Create an inbound skid pickup (Customer -> GASTECH PLANT)
 */
export async function createPickup(input: CreatePickupInput): Promise<string> {
  try {
    const result = await db.execute<{ movement_id: string }>(sql`
      SELECT create_pickup(
        ${input.truckId}::uuid,
        ${input.customerId}::uuid,
        ${input.skidIdIn ?? null}::uuid,
        ${input.note ?? null}::text,
        ${input.forceOverride ?? false}::boolean
      ) AS movement_id
    `);

    const rows = Array.isArray(result) ? result : result.rows;
    const movementId = rows[0]?.movement_id;

    if (!movementId) {
      throw new Error('Failed to retrieve movement ID from database');
    }

    return movementId;
    
  } catch (error) {
    throw formatDbError(error);
  }
}

/**
 * 3. Complete an active 'dispatch' or 'pickup' movement
 */
export async function completeMovement(input: CompleteMovementInput): Promise<void> {
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
    throw formatDbError(error);
  }
}

/**
 * 4. Cancel an in-progress 'dispatch' or 'pickup' and reset truck/skid statuses
 */
export async function cancelMovement(input: CancelMovementInput): Promise<void> {
  try {
    await db.execute(sql`
      SELECT cancel_dispatch(
        ${input.movementId}::uuid,
        ${input.note ?? null}::text
      )
    `);
  } catch (error) {
    throw formatDbError(error);
  }
}
