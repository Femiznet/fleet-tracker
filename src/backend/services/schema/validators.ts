import { z } from 'zod';
import {
  customerType,
  truckStatusEnum,
  skidStatusEnum,
  skidFillStateEnum,
  skidBayEnum,
  skidOwnerEnum,
  tripDirectionEnum,
  tripStatusEnum,
} from '@/backend/db/schema';

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1),
  geofenceName: z.string().trim().min(1).nullish(),
  location: z.string().trim().min(1).nullish(),
  type: z.enum(customerType.enumValues),
  isActive: z.boolean().default(true),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const createTruckSchema = z.object({
  truckNum: z.string().trim().min(1),
  slugNum: z.string().trim().min(1).nullish(),
  lat: z.number(),
  lon: z.number(),
  currentLoc: z.string().trim().min(1).default('pending'),
  speed: z.number().int().min(0).default(0),
  status: z.enum(truckStatusEnum.enumValues).default('available'),
});

export const updateTruckSchema = createTruckSchema.partial();

export const createSkidSchema = z.object({
  skidNum: z.string().trim().min(1),
  slugNum: z.string().trim().min(1).nullish(),
  customerId: z.string().uuid().nullish(),
  currentLoc: z.string().trim().min(1).default('pending'),
  status: z.enum(skidStatusEnum.enumValues).default('available'),
  isNew: z.boolean().default(false),
  owner: z.enum(skidOwnerEnum.enumValues).default('gastech'),
});

export const updateSkidSchema = createSkidSchema.partial();

export const createDriverSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1).nullish(),
  currentTruck: z.string().trim().min(1).nullish(),
});

export const updateDriverSchema = createDriverSchema.partial();

export const createTripSchema = z.object({
  movementId: z.string().uuid(),
  status: z.enum(tripStatusEnum.enumValues).default('in_transit'),
  direction: z.enum(tripDirectionEnum.enumValues),
  origin: z.string().trim().min(1),
  destination: z.string().trim().min(1),
  arrived: z.boolean().default(false),
});

export const updateTripSchema = createTripSchema.partial();

export const createPlantReportSchema = z.object({
  officersOnDuty: z.string().trim().min(1),
  metrics: z.record(z.string(), z.unknown()).default({}),
  skidUpdates: z
    .array(
      z.object({
        id: z.string().uuid(),
        fillState: z.enum(skidFillStateEnum.enumValues).optional(),
        bay: z.enum(skidBayEnum.enumValues).optional(),
        note: z.string().trim().nullish(),
      })
    )
    .default([]),
  notes: z.string().trim().nullish(),
});

export const updatePlantReportSchema = z.object({
  officersOnDuty: z.string().trim().min(1).optional(),
  metrics: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().nullish(),
});

export const updatePlantSkidStatusSchema = z.object({
  fillState: z.enum(skidFillStateEnum.enumValues),
  bay: z.enum(skidBayEnum.enumValues),
  isOnMaintenance: z.boolean().optional(),
  maintenanceNote: z.string().trim().nullish(),
  note: z.string().trim().nullish(),
});

export const updatePlantTruckStatusSchema = z.object({
  isStandby: z.boolean().optional(),
  isOnMaintenance: z.boolean().optional(),
  maintenanceNote: z.string().trim().nullish(),
  note: z.string().trim().nullish(),
});
