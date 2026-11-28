import { z } from 'zod';
import {
  plantStatusMetricsSchema,
  skidStateEnum,
  type PlantStatusMetrics,
} from '@fleet/database/schema';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be a valid YYYY-MM-DD date')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, 'date must be a valid YYYY-MM-DD date');

const skidYardUpdateSchema = z
  .object({
    id: z.string().uuid(),
    state: z.enum(skidStateEnum.enumValues).optional(),
    isForWashing: z.boolean().optional(),
  })
  .strict()
  .refine(
    (update) => update.state !== undefined || update.isForWashing !== undefined,
    'Provide state or isForWashing to update',
  );

export const plantStatusDateQuerySchema = z
  .object({
    date: dateSchema.optional(),
  })
  .strict();

export const updatePlantStatusSchema = z
  .object({
    officersOnDuty: z.string().trim().min(1).max(255),
    metrics: plantStatusMetricsSchema.default({}),
    skidUpdates: z.array(skidYardUpdateSchema).default([]),
    notes: z.string().nullable().optional(),
  })
  .strict();

export type SkidYardUpdate = z.infer<typeof skidYardUpdateSchema>;
export type UpdatePlantStatusInput = z.infer<typeof updatePlantStatusSchema>;
export type { PlantStatusMetrics };
