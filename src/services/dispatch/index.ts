import { db } from '@/db';
import { formatDbError } from '@/lib/errors';
import { sql } from 'drizzle-orm';

export type DispatchTrackingMode = 'live' | 'manual';

export interface CreateDispatchInput {
  truckId: string;
  customerId: string;
  skidIdOut: string;
  note?: string | null;
  trackingMode?: DispatchTrackingMode;
}

export type ManualDispatchAction = 'arrived_customer' | 'returning';

export interface CreatePickupInput {
  truckId: string;
  customerId: string;
  skidIdIn?: string | null;
  note?: string | null;
  forceOverride?: boolean;
}

export type skidInState = "empty" | "loaded";

export interface CompleteMovementInput {
  movementId: string;
  skidIdIn?: string | null;
  note?: string | null;
  skidInState: skidInState;
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
        ${input.trackingMode ?? 'live'}::tracking_mode
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

export async function manualDispatchAction(input: {
  movementId: string;
  action: ManualDispatchAction;
}): Promise<void> {
  try {
    await db.execute(sql`
      SELECT manual_dispatch_action(
        ${input.movementId}::uuid,
        ${input.action}::text
      )
    `);
  } catch (error) {
    throw formatDbError(error);
  }
}

export async function switchDispatchTrackingMode(input: {
  movementId: string;
  trackingMode: DispatchTrackingMode;
}): Promise<void> {
  try {
    await db.execute(sql`
      SELECT switch_dispatch_tracking_mode(
        ${input.movementId}::uuid,
        ${input.trackingMode}::tracking_mode
      )
    `);
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
        ${input.skidInState}
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
