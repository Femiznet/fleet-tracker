import { z } from 'zod';
import { customerSkidLoadingStateEnum } from '@fleet/database/schema';

export const customerSkidLoadingIdSchema = z.string().uuid();

export const customerSkidLoadingStateSchema = z.enum(
  customerSkidLoadingStateEnum.enumValues,
);

export const createCustomerSkidLoadingSchema = z
  .object({
    customerId: z.string().uuid(),
    skidNum: z.string().trim().min(1).max(100),
  })
  .strict();

export const updateCustomerSkidLoadingSchema = z
  .object({
    state: customerSkidLoadingStateSchema.optional(),
    isForWashing: z.boolean().optional(),
  })
  .strict()
  .refine(
    (input) => input.state !== undefined || input.isForWashing !== undefined,
    'Provide state or isForWashing to update',
  );

export const customerSkidLoadingListQuerySchema = z
  .object({
    includeHistory: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
  })
  .strict();

export type CustomerSkidLoadingState = z.infer<
  typeof customerSkidLoadingStateSchema
>;
export type CreateCustomerSkidLoadingInput = z.infer<
  typeof createCustomerSkidLoadingSchema
>;
export type UpdateCustomerSkidLoadingInput = z.infer<
  typeof updateCustomerSkidLoadingSchema
>;
