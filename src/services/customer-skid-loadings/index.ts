import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { customers } from '@/db/schema/customers';
import { customerSkidLoadings } from '@/db/schema/customer-skid-loading';
import type {
  CreateCustomerSkidLoadingInput,
  UpdateCustomerSkidLoadingInput,
} from './validator';

export type {
  CreateCustomerSkidLoadingInput,
  CustomerSkidLoadingState,
  UpdateCustomerSkidLoadingInput,
} from './validator';

export class CustomerSkidLoadingError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'CustomerSkidLoadingError';
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

export async function getCustomerSkidLoadings(includeHistory = false) {
  const query = db
    .select({
      id: customerSkidLoadings.id,
      customerId: customerSkidLoadings.customerId,
      customerName: customers.name,
      skidNum: customerSkidLoadings.skidNum,
      state: customerSkidLoadings.state,
      isForWashing: customerSkidLoadings.isForWashing,
      arrivedAt: customerSkidLoadings.arrivedAt,
      loadedAt: customerSkidLoadings.loadedAt,
      dispatchedAt: customerSkidLoadings.dispatchedAt,
    })
    .from(customerSkidLoadings)
    .innerJoin(customers, eq(customerSkidLoadings.customerId, customers.id));

  if (includeHistory) {
    return query.orderBy(desc(customerSkidLoadings.arrivedAt));
  }

  return query
    .where(isNull(customerSkidLoadings.dispatchedAt))
    .orderBy(desc(customerSkidLoadings.arrivedAt));
}

export async function createCustomerSkidLoading(
  input: CreateCustomerSkidLoadingInput
) {
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.id, input.customerId))
    .limit(1);

  if (!customer) {
    throw new CustomerSkidLoadingError('Customer not found', 404);
  }

  const [existingLoading] = await db
    .select({ id: customerSkidLoadings.id })
    .from(customerSkidLoadings)
    .where(
      and(
        isNull(customerSkidLoadings.dispatchedAt),
        sql`lower(btrim(${customerSkidLoadings.skidNum})) = lower(btrim(${input.skidNum}))`
      )
    )
    .limit(1);

  if (existingLoading) {
    throw new CustomerSkidLoadingError(
      'This customer skid already has an active plant loading',
      409
    );
  }

  try {
    const [loading] = await db
      .insert(customerSkidLoadings)
      .values({
        customerId: input.customerId,
        skidNum: input.skidNum.trim(),
      })
      .returning();

    return loading;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new CustomerSkidLoadingError(
        'This customer skid already has an active plant loading',
        409
      );
    }
    throw error;
  }
}

export async function updateCustomerSkidLoading(
  id: string,
  input: UpdateCustomerSkidLoadingInput
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(customerSkidLoadings)
      .where(eq(customerSkidLoadings.id, id))
      .for('update');

    if (!existing) {
      throw new CustomerSkidLoadingError('Customer skid loading not found', 404);
    }

    if (existing.dispatchedAt) {
      throw new CustomerSkidLoadingError(
        'A dispatched customer skid loading cannot be changed',
        409
      );
    }

    const nextState = input.state ?? existing.state;
    const nextWashing = input.isForWashing ?? existing.isForWashing;
    const canWash = nextState === 'empty' || nextState === 'loaded';

    if (nextWashing && !canWash) {
      throw new CustomerSkidLoadingError(
        'Only empty or loaded customer skids can be selected for washing',
        400
      );
    }

    const [updated] = await tx
      .update(customerSkidLoadings)
      .set({
        state: nextState,
        isForWashing: canWash && nextWashing,
        ...(nextState === 'loaded' && !existing.loadedAt
          ? { loadedAt: new Date() }
          : {}),
      })
      .where(
        and(
          eq(customerSkidLoadings.id, id),
          isNull(customerSkidLoadings.dispatchedAt)
        )
      )
      .returning();

    return updated;
  });
}

export async function dispatchCustomerSkidLoading(id: string) {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT dispatch_customer_skid_loading(${id}::uuid)
      `);

      const [updated] = await tx
        .select()
        .from(customerSkidLoadings)
        .where(eq(customerSkidLoadings.id, id));

      if (!updated) {
        throw new Error('Dispatched customer skid loading could not be retrieved');
      }

      return updated;
    });
  } catch (error) {
    const code = getDatabaseErrorCode(error);
    if (code === 'P1001') {
      throw new CustomerSkidLoadingError('Customer skid loading not found', 404);
    }
    if (code === 'P1002') {
      throw new CustomerSkidLoadingError(
        'Customer skid loading has already been dispatched',
        409
      );
    }
    if (code === 'P1003') {
      throw new CustomerSkidLoadingError(
        'Customer skid must be loaded before it can be dispatched',
        409
      );
    }
    throw error;
  }
}
