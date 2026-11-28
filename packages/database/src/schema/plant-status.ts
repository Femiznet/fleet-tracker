import { sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { skidStateEnum } from './enums';

export const plantStatusMetricsSchema = z
  .object({
    inletPressureBar: z.number().finite().optional(),
    loadingPressureBar: z.number().finite().optional(),
    landingGearBox: z
      .object({
        loadingAndWashingBay: z.number().finite().optional(),
        workshop: z.number().finite().optional(),
        wooden: z.number().finite().optional(),
      })
      .strict()
      .optional(),
    newChassisInPlant: z.number().finite().optional(),
    compressors: z.record(z.string(), z.string()).optional(),
    extraFields: z
      .record(z.string(), z.union([z.string(), z.number().finite()]))
      .optional(),
  })
  .strict();

export type PlantStatusMetrics = z.infer<typeof plantStatusMetricsSchema>;
export type SkidState = (typeof skidStateEnum.enumValues)[number];

export interface PlantFleetSnapshot {
  skidsLoading: { customer: string[]; gastech: string[] };
  skidsOnHold: string[];
  skidsLoaded: { customer: string[]; gastech: string[] };
  skidsEmpty: { customer: string[]; gastech: string[] };
  newLoadedSkids: string[];
  skidsForWashing: { skidNum: string; state: SkidState }[];
  trucksOnGround: string[];
  standbyTrucks: string[];
  trucksInTransit: { truckNum: string; customer: string }[];
  returningTrucks: { truckNum: string; customer: string }[];
  maintenance: { skids: string[]; trucks: string[] };
}

export const plantStatus = pgTable(
  'plant_status',
  {
    id: integer('id').primaryKey().default(1),
    officersOnDuty: varchar('officers_on_duty', { length: 255 })
      .notNull()
      .default(''),
    metrics: jsonb('metrics').$type<PlantStatusMetrics>().notNull().default({}),
    notes: text('notes'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [check('plant_status_singleton_id_check', sql`${table.id} = 1`)],
);

export type PlantStatus = typeof plantStatus.$inferSelect;
