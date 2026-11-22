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

const skidRegistrationUnitSchema = z.object({
  skidNum: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toUpperCase()),
  slugNum: z
    .string()
    .trim()
    .nullish()
    .transform((value) => value || null),
});

export const registerSkidsSchema = z
  .object({
    skids: z.array(skidRegistrationUnitSchema).min(1).max(200),
    owner: z.enum(skidOwnerEnum.enumValues),
    customerId: z.string().uuid().optional(),
    customerName: z.string().trim().min(1).max(255).optional(),
    fillState: z.enum(skidFillStateEnum.enumValues).optional(),
    bay: z.enum(skidBayEnum.enumValues).optional(),
  })
  .superRefine((data, context) => {
    const skidNumbers = new Set<string>();
    const slugNumbers = new Set<string>();
    data.skids.forEach((skid, index) => {
      const normalizedNumber = skid.skidNum.toUpperCase();
      if (skidNumbers.has(normalizedNumber)) {
        context.addIssue({
          code: 'custom',
          path: ['skids', index, 'skidNum'],
          message: 'Skid numbers must be unique within the registration.',
        });
      }
      skidNumbers.add(normalizedNumber);

      const normalizedSlug = skid.slugNum?.toUpperCase();
      if (normalizedSlug && slugNumbers.has(normalizedSlug)) {
        context.addIssue({
          code: 'custom',
          path: ['skids', index, 'slugNum'],
          message: 'Slug numbers must be unique within the registration.',
        });
      }
      if (normalizedSlug) slugNumbers.add(normalizedSlug);
    });

    if (data.owner === 'customer' && !data.customerId && !data.customerName) {
      context.addIssue({
        code: 'custom',
        path: ['customerName'],
        message: 'Select or enter a customer for customer-owned skids.',
      });
    }
    if (data.owner === 'customer' && data.customerId && data.customerName) {
      context.addIssue({
        code: 'custom',
        path: ['customerName'],
        message: 'Choose an existing customer or enter a new customer name.',
      });
    }
    if (data.owner === 'gastech' && (data.customerId || data.customerName)) {
      context.addIssue({
        code: 'custom',
        path: ['customerId'],
        message: 'Gastech-owned skids cannot be assigned to a customer.',
      });
    }
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
