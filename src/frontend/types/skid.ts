import { z } from 'zod';

export const SkidStatusSchema = z.enum(['available', 'in_transit', 'at_customer', 'maintenance']);

export const SkidOwnerSchema = z.enum(['customer', 'gastech']);

export const SkidSchema = z.object({
  id: z.string(),
  skidNum: z.string(),
  slugNum: z.string().nullable(),
  customerId: z.string().nullable(),
  currentLoc: z.string(),
  status: SkidStatusSchema,
  isNew: z.boolean(),
  owner: SkidOwnerSchema,
  isOnMaintenance: z.boolean().optional(),
});

export type SkidStatus = z.infer<typeof SkidStatusSchema>;
export type SkidOwner = z.infer<typeof SkidOwnerSchema>;
export type Skid = z.infer<typeof SkidSchema>;
