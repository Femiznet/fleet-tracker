import { db, dbtx, type DbTransaction } from '@/backend/db';
import { formatDbError } from '@/backend/lib/errors';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { customers, drivers, movements, skids, trucks } from '@/backend/db/schema';
import { formatDispatchNotification } from '@/backend/services/messages/dispatch-review';
import type { DispatchDetails } from '@/backend/services/messages/utils/dispatchParser';

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

class DirectDispatchValidationError extends Error {}

/**
 * 1. Create a new full roundtrip dispatch (GASTECH PLANT -> Customer -> GASTECH PLANT)
 */
export async function createDispatch(
  input: CreateDispatchInput,
  tx?: DbTransaction
): Promise<string> {
  try {
    const result = await dbtx(tx).execute<{ movement_id: string }>(sql`
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

export async function createDirectDispatch(input: CreateDispatchInput, tx?: DbTransaction) {
  try {
    const create = async (transaction: DbTransaction) => {
      const [truck] = await transaction
        .select({ group: trucks.group })
        .from(trucks)
        .where(eq(trucks.id, input.truckId))
        .for('update');

      if (!truck) {
        throw new DirectDispatchValidationError('Truck not found');
      }
      if (truck.group?.trim().toUpperCase() !== 'GASTECH VEHICLES') {
        throw new DirectDispatchValidationError('Direct dispatch requires a Gastech vehicle');
      }

      const movementId = await createDispatch(input, transaction);
      const [movementDetails] = await transaction
        .select({
          createdAt: movements.createdAt,
          truckNumber: trucks.truckNum,
          skidNumber: skids.skidNum,
          customerName: customers.name,
          driverName: drivers.name,
          driverContact: drivers.phone,
        })
        .from(movements)
        .innerJoin(trucks, eq(movements.truckId, trucks.id))
        .innerJoin(skids, eq(movements.skidIdOut, skids.id))
        .innerJoin(customers, eq(movements.customerId, customers.id))
        .leftJoin(drivers, eq(drivers.currentTruck, trucks.truckNum))
        .where(eq(movements.id, movementId));

      if (!movementDetails) {
        throw new Error('Created dispatch details could not be loaded');
      }

      const notificationDueAt = new Date(movementDetails.createdAt.getTime() + 10 * 60 * 1000);
      const notificationText = formatDispatchNotification({
        truckNumber: movementDetails.truckNumber,
        skidNumber: movementDetails.skidNumber,
        customerName: movementDetails.customerName,
        driverName: movementDetails.driverName,
        driverContact: movementDetails.driverContact,
        dateOut: movementDetails.createdAt.toISOString().slice(0, 10),
        timeOut: `${movementDetails.createdAt.toISOString().slice(11, 16)} UTC`,
      } satisfies DispatchDetails);

      await transaction
        .update(movements)
        .set({ notificationDueAt, notificationText })
        .where(eq(movements.id, movementId));

      return { movementId, notificationDueAt, notificationText };
    };

    return tx ? await create(tx) : await db.transaction(create);
  } catch (error) {
    if (error instanceof DirectDispatchValidationError) throw error;
    throw formatDbError(error);
  }
}

/**
 * 2. Create an inbound skid pickup (Customer -> GASTECH PLANT)
 */
export async function createPickup(input: CreatePickupInput, tx?: DbTransaction): Promise<string> {
  try {
    const result = await dbtx(tx).execute<{ movement_id: string }>(sql`
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
export async function completeMovement(
  input: CompleteMovementInput,
  tx?: DbTransaction
): Promise<void> {
  try {
    await dbtx(tx).execute(sql`
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
export async function cancelMovement(input: CancelMovementInput, tx?: DbTransaction): Promise<void> {
  try {
    await dbtx(tx).execute(sql`
      SELECT cancel_dispatch(
        ${input.movementId}::uuid,
        ${input.note ?? null}::text
      )
    `);
  } catch (error) {
    throw formatDbError(error);
  }
}

export async function markMovementNotified(
  movementId: string,
  tx?: DbTransaction
): Promise<boolean> {
  const [updated] = await dbtx(tx)
    .update(movements)
    .set({ notifiedAt: new Date() })
    .where(
      and(
        eq(movements.id, movementId),
        eq(movements.type, 'dispatch'),
        isNull(movements.notifiedAt),
        sql`${movements.notificationDueAt} IS NOT NULL`,
        sql`${movements.notificationText} IS NOT NULL`
      )
    )
    .returning({ id: movements.id });

  return Boolean(updated);
}
