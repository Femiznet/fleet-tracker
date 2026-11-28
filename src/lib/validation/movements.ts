import { z } from 'zod';

const uuidSchema = z.string().uuid();
const noteSchema = z.string().nullable().optional();

export const movementIdSchema = uuidSchema;

export const createDispatchRequestSchema = z
  .object({
    truckId: uuidSchema,
    customerId: uuidSchema,
    skidIdOut: uuidSchema,
    note: noteSchema,
    trackingMode: z.enum(['live', 'manual']).default('live'),
  })
  .strict();

export const createPickupRequestSchema = z
  .object({
    truckId: uuidSchema,
    customerId: uuidSchema,
    skidIdIn: uuidSchema.nullable().optional(),
    note: noteSchema,
    forceOverride: z.boolean().default(false),
  })
  .strict();

export const completeMovementRequestSchema = z
  .object({
    skidIdIn: uuidSchema.nullable().optional(),
    note: noteSchema,
    skidInState: z.enum(['empty', 'loaded']),
  })
  .strict();

export const cancelMovementRequestSchema = z
  .object({
    note: noteSchema,
  })
  .strict();

export const manualDispatchActionRequestSchema = z
  .object({
    action: z.enum(['arrived_customer', 'returning']),
  })
  .strict();

export const trackingModeRequestSchema = z
  .object({
    trackingMode: z.enum(['live', 'manual']),
  })
  .strict();
