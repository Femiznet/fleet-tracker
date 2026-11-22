import { z } from 'zod';

export const TruckStatusSchema = z.enum([
  'available',
  'in_transit',
  'standby',
  'at_customer',
  'maintenance',
]);

export const TruckSchema = z.object({
  id: z.string(),
  truckNum: z.string(),
  slugNum: z.string().nullable(),
  lat: z.number(),
  lon: z.number(),
  currentLoc: z.string(),
  speed: z.number(),
  status: TruckStatusSchema,
});

export type TruckStatus = z.infer<typeof TruckStatusSchema>;
export type Truck = z.infer<typeof TruckSchema>;
