import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { customers } from '@/db/schema/customers';
import { customerSkidVisits } from '@/db/schema/customer-skid-visit';
import type {
  CreateCustomerSkidVisitInput,
  UpdateCustomerSkidVisitInput,
} from './validator';

export type {
  CreateCustomerSkidVisitInput,
  CustomerSkidVisitState,
  UpdateCustomerSkidVisitInput,
} from './validator';

export class CustomerSkidVisitError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'CustomerSkidVisitError';
  }
}

function isUniqueViolation(error: unknown): boolean {
  return getDatabaseErrorCode(error) === '23505';
}

function getDatabaseErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  if ('code' in error && typeof error.code === 'string') return error.code;
  if (
    'cause' in error &&
    error.cause &&
    typeof error.cause === 'object' &&
    'code' in error.cause &&
    typeof error.cause.code === 'string'
  ) {
    return error.cause.code;
  }
  return undefined;
}

export async function getCustomerSkidVisits(includeHistory = false) {
  const query = db
    .select({
      id: customerSkidVisits.id,
      customerId: customerSkidVisits.customerId,
      customerName: customers.name,
      skidNum: customerSkidVisits.skidNum,
      state: customerSkidVisits.state,
      isForWashing: customerSkidVisits.isForWashing,
      arrivedAt: customerSkidVisits.arrivedAt,
      loadedAt: customerSkidVisits.loadedAt,
      dispatchedAt: customerSkidVisits.dispatchedAt,
    })
    .from(customerSkidVisits)
    .innerJoin(customers, eq(customerSkidVisits.customerId, customers.id));

  if (includeHistory) {
    return query.orderBy(desc(customerSkidVisits.arrivedAt));
  }

  return query
    .where(isNull(customerSkidVisits.dispatchedAt))
    .orderBy(desc(customerSkidVisits.arrivedAt));
}

export async function createCustomerSkidVisit(
  input: CreateCustomerSkidVisitInput
) {
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.id, input.customerId))
    .limit(1);

  if (!customer) {
    throw new CustomerSkidVisitError('Customer not found', 404);
  }

  const [existingVisit] = await db
    .select({ id: customerSkidVisits.id })
    .from(customerSkidVisits)
    .where(
      and(
        isNull(customerSkidVisits.dispatchedAt),
        sql`lower(btrim(${customerSkidVisits.skidNum})) = lower(btrim(${input.skidNum}))`
      )
    )
    .limit(1);

  if (existingVisit) {
    throw new CustomerSkidVisitError(
      'This customer skid already has an active plant visit',
      409
    );
  }

  try {
    const [visit] = await db
      .insert(customerSkidVisits)
      .values({
        customerId: input.customerId,
        skidNum: input.skidNum.trim(),
      })
      .returning();

    return visit;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new CustomerSkidVisitError(
        'This customer skid already has an active plant visit',
        409
      );
    }
    throw error;
  }
}

export async function updateCustomerSkidVisit(
  id: string,
  input: UpdateCustomerSkidVisitInput
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(customerSkidVisits)
      .where(eq(customerSkidVisits.id, id))
      .for('update');

    if (!existing) {
      throw new CustomerSkidVisitError('Customer skid visit not found', 404);
    }

    if (existing.dispatchedAt) {
      throw new CustomerSkidVisitError(
        'A dispatched customer skid visit cannot be changed',
        409
      );
    }

    const nextState = input.state ?? existing.state;
    const nextWashing = input.isForWashing ?? existing.isForWashing;
    const canWash = nextState === 'empty' || nextState === 'loaded';

    if (nextWashing && !canWash) {
      throw new CustomerSkidVisitError(
        'Only empty or loaded customer skids can be selected for washing',
        400
      );
    }

    const [updated] = await tx
      .update(customerSkidVisits)
      .set({
        state: nextState,
        isForWashing: canWash && nextWashing,
        ...(nextState === 'loaded' && !existing.loadedAt
          ? { loadedAt: new Date() }
          : {}),
      })
      .where(
        and(
          eq(customerSkidVisits.id, id),
          isNull(customerSkidVisits.dispatchedAt)
        )
      )
      .returning();

    return updated;
  });
}

export async function dispatchCustomerSkidVisit(id: string) {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT dispatch_customer_skid_visit(${id}::uuid)
      `);

      const [updated] = await tx
        .select()
        .from(customerSkidVisits)
        .where(eq(customerSkidVisits.id, id));

      if (!updated) {
        throw new Error('Dispatched customer skid visit could not be retrieved');
      }

      return updated;
    });
  } catch (error) {
    const code = getDatabaseErrorCode(error);
    if (code === 'P1001') {
      throw new CustomerSkidVisitError('Customer skid visit not found', 404);
    }
    if (code === 'P1002') {
      throw new CustomerSkidVisitError(
        'Customer skid visit has already been dispatched',
        409
      );
    }
    if (code === 'P1003') {
      throw new CustomerSkidVisitError(
        'Customer skid must be loaded before it can be dispatched',
        409
      );
    }
    throw error;
  }
}
