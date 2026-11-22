import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/backend/db';
import { customers, plantSkidStatuses, skids } from '@/backend/db/schema';
import type { z } from 'zod';
import { registerSkidsSchema } from '@/backend/services/schema/validators';

export class SkidRegistrationError extends Error {
  constructor(
    message: string,
    readonly code: 'CUSTOMER_NOT_FOUND' | 'DUPLICATE_SKID'
  ) {
    super(message);
    this.name = 'SkidRegistrationError';
  }
}

type SkidRegistration = z.infer<typeof registerSkidsSchema>;

export async function registerSkids(input: SkidRegistration) {
  return db.transaction(async (tx) => {
    let customerId: string | null = null;
    let customerCreated = false;

    if (input.owner === 'customer') {
      if (input.customerId) {
        const [customer] = await tx
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.id, input.customerId))
          .limit(1);
        if (!customer) {
          throw new SkidRegistrationError('Selected customer was not found.', 'CUSTOMER_NOT_FOUND');
        }
        customerId = customer.id;
      } else if (input.customerName) {
        const normalizedName = input.customerName.trim();
        const [existingCustomer] = await tx
          .select({ id: customers.id })
          .from(customers)
          .where(sql`LOWER(TRIM(${customers.name})) = LOWER(${normalizedName})`)
          .limit(1);

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const [createdCustomer] = await tx
            .insert(customers)
            .values({ name: normalizedName })
            .onConflictDoNothing()
            .returning({ id: customers.id });
          if (createdCustomer) {
            customerId = createdCustomer.id;
            customerCreated = true;
          } else {
            const [conflictingCustomer] = await tx
              .select({ id: customers.id })
              .from(customers)
              .where(sql`LOWER(TRIM(${customers.name})) = LOWER(${normalizedName})`)
              .limit(1);
            if (!conflictingCustomer) {
              throw new SkidRegistrationError(
                'Customer could not be created. Check the customer name and try again.',
                'CUSTOMER_NOT_FOUND'
              );
            }
            customerId = conflictingCustomer.id;
          }
        }
      }
    }

    const skidNumbers = input.skids.map((skid) => skid.skidNum.trim().toUpperCase());
    const existingSkids = await tx
      .select({ skidNum: skids.skidNum })
      .from(skids)
      .where(inArray(sql<string>`UPPER(TRIM(${skids.skidNum}))`, skidNumbers));
    if (existingSkids.length) {
      throw new SkidRegistrationError(
        `Skid number already registered: ${existingSkids.map((skid) => skid.skidNum).join(', ')}`,
        'DUPLICATE_SKID'
      );
    }

    const slugNumbers = input.skids.flatMap((skid) => (skid.slugNum ? [skid.slugNum] : []));
    if (slugNumbers.length) {
      const existingSlugs = await tx
        .select({ slugNum: skids.slugNum })
        .from(skids)
        .where(inArray(sql<string>`UPPER(TRIM(${skids.slugNum}))`, slugNumbers));
      if (existingSlugs.length) {
        throw new SkidRegistrationError(
          `Slug number already registered: ${existingSlugs
            .map((skid) => skid.slugNum)
            .filter(Boolean)
            .join(', ')}`,
          'DUPLICATE_SKID'
        );
      }
    }

    const createdSkids = await tx
      .insert(skids)
      .values(
        input.skids.map((skid) => ({
          skidNum: skid.skidNum.trim().toUpperCase(),
          slugNum: skid.slugNum?.trim() || null,
          owner: input.owner,
          customerId,
        }))
      )
      .returning();

    await tx.insert(plantSkidStatuses).values(
      createdSkids.map((skid) => ({
        skidId: skid.id,
        ...(input.fillState ? { fillState: input.fillState } : {}),
        ...(input.fillState === 'loading'
          ? { bay: 'loading_bay' as const }
          : input.bay
            ? { bay: input.bay }
            : {}),
        isOnMaintenance: false,
        maintenanceNote: null,
      }))
    );

    return { skids: createdSkids, customerCreated };
  });
}
