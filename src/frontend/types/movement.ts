import { z } from 'zod';

export const MovementOptionsSchema = z.object({
  trucks: z.array(
    z.object({
      id: z.string(),
      truckNum: z.string(),
      slugNum: z.string().nullable(),
      currentLoc: z.string(),
      status: z.literal('available'),
      driverName: z.string().nullable(),
      driverContact: z.string().nullable(),
    })
  ),
  skids: z.array(
    z.object({
      id: z.string(),
      skidNum: z.string(),
      slugNum: z.string().nullable(),
      customerId: z.string().nullable(),
      currentLoc: z.string(),
      status: z.enum(['available', 'at_customer', 'in_transit']),
      owner: z.enum(['customer', 'gastech']),
    })
  ),
  customers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      geofenceName: z.string().nullable(),
    })
  ),
});

export const ActiveMovementSchema = z.object({
  id: z.string(),
  type: z.enum(['dispatch', 'pickup']),
  status: z.literal('in_progress'),
  startedAt: z.string().datetime(),
  note: z.string().nullable(),
  truckId: z.string(),
  truckNum: z.string(),
  truckStatus: z.enum(['available', 'in_transit', 'standby', 'at_customer', 'maintenance']),
  truckCurrentLoc: z.string(),
  truckSpeed: z.number(),
  customerId: z.string().nullable(),
  customerName: z.string().nullable(),
  customerGeofence: z.string().nullable(),
  skidIdOut: z.string().nullable(),
  skidNumOut: z.string().nullable(),
  skidIdIn: z.string().nullable(),
  skidNumIn: z.string().nullable(),
  outboundTripStatus: z.enum(['in_transit', 'arrived', 'cancelled']).nullable(),
  inboundTripStatus: z.enum(['in_transit', 'arrived', 'cancelled']).nullable(),
  currentDirection: z.enum(['outbound', 'inbound']),
  currentTripStatus: z.enum(['in_transit', 'arrived', 'cancelled']).nullable(),
  truckAtPlant: z.boolean(),
});

export const DirectDispatchResponseSchema = z.object({
  movementId: z.string(),
  notificationDueAt: z.string().datetime(),
  notificationText: z.string(),
});

export const MovementActionResponseSchema = z.object({
  movementId: z.string(),
  status: z.string(),
});

export type MovementOptions = z.infer<typeof MovementOptionsSchema>;
export type ActiveMovement = z.infer<typeof ActiveMovementSchema>;
export type DirectDispatchResult = z.infer<typeof DirectDispatchResponseSchema>;
