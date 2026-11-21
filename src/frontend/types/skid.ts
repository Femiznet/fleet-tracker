import { z } from 'zod';

export const SkidStatusSchema = z.enum([
  'available',
  'in_transit',
  'at_customer',
  'maintenance',
]);

export const SkidFillStateSchema = z.enum(['empty', 'loading', 'loaded']);
export const SkidBayStateSchema = z.enum(['idle', 'on_hold', 'washing']);

export const SkidSchema = z.object({
  id: z.string(),
  skidNum: z.string(),
  slugNum: z.string().nullable(),
  customerId: z.string().nullable(),
  currentLoc: z.string(),
  status: SkidStatusSchema,
  fillState: SkidFillStateSchema,
  bayState: SkidBayStateSchema,
  isNew: z.boolean(),
});

export type SkidStatus = z.infer<typeof SkidStatusSchema>;
export type SkidFillState = z.infer<typeof SkidFillStateSchema>;
export type SkidBayState = z.infer<typeof SkidBayStateSchema>;
export type Skid = z.infer<typeof SkidSchema>;
