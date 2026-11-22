import { z } from 'zod';

export const TruckTrackerItemSchema = z.object({
  id: z.string(),
  truckNum: z.string(),
  slugNum: z.string().nullable(),
  lat: z.number(),
  lon: z.number(),
  currentLoc: z.string(),
  speed: z.number(),
  status: z.enum(['available', 'in_transit', 'standby', 'at_customer', 'maintenance']),
  activeMovement: z
    .object({
      id: z.string(),
      type: z.enum(['dispatch', 'pickup']),
      direction: z.enum(['outbound', 'inbound']),
      tripStatus: z.enum(['in_transit', 'arrived', 'cancelled']).nullable(),
      customerName: z.string().nullable(),
      startedAt: z.string().datetime(),
      skidNumOut: z.string().nullable(),
      skidNumIn: z.string().nullable(),
    })
    .nullable(),
  isStandby: z.boolean(),
  isOnMaintenance: z.boolean(),
  maintenanceNote: z.string().nullable(),
  note: z.string().nullable(),
  geofence: z.string().nullable(),
});

export const SkidTrackerItemSchema = z.object({
  id: z.string(),
  skidNum: z.string(),
  slugNum: z.string().nullable(),
  currentLoc: z.string(),
  status: z.enum(['available', 'in_transit', 'at_customer', 'maintenance']),
  owner: z.enum(['customer', 'gastech']),
  isNew: z.boolean(),
  customerName: z.string().nullable(),
  fillState: z.enum(['empty', 'loading', 'loaded', 'on_hold']).nullable(),
  bay: z.enum(['washing_bay', 'loading_bay', 'parking_bay']).nullable(),
  isOnMaintenance: z.boolean(),
  maintenanceNote: z.string().nullable(),
  note: z.string().nullable(),
});

export const TrackerDataSchema = z.object({
  trucks: z.array(TruckTrackerItemSchema),
  skids: z.array(SkidTrackerItemSchema),
});

export type TruckTrackerItem = z.infer<typeof TruckTrackerItemSchema>;
export type SkidTrackerItem = z.infer<typeof SkidTrackerItemSchema>;
export type TrackerData = z.infer<typeof TrackerDataSchema>;
