import { z } from 'zod';
import { customerSkidVisitStateEnum } from '@/db/schema/enums';

export const customerSkidVisitIdSchema = z.string().uuid();

export const customerSkidVisitStateSchema = z.enum(
  customerSkidVisitStateEnum.enumValues
);

export const createCustomerSkidVisitSchema = z
  .object({
    customerId: z.string().uuid(),
    skidNum: z.string().trim().min(1).max(100),
  })
  .strict();

export const updateCustomerSkidVisitSchema = z
  .object({
    state: customerSkidVisitStateSchema.optional(),
    isForWashing: z.boolean().optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.state !== undefined || input.isForWashing !== undefined,
    'Provide state or isForWashing to update'
  );

export const customerSkidVisitListQuerySchema = z
  .object({
    includeHistory: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
  })
  .strict();

export type CustomerSkidVisitState = z.infer<
  typeof customerSkidVisitStateSchema
>;
export type CreateCustomerSkidVisitInput = z.infer<
  typeof createCustomerSkidVisitSchema
>;
export type UpdateCustomerSkidVisitInput = z.infer<
  typeof updateCustomerSkidVisitSchema
>;
