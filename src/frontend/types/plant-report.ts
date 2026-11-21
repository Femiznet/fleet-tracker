import { z } from 'zod';
import { PaginationMetaSchema } from './dispatch-review';

export const PlantFleetSnapshotSchema = z.object({
  skidsLoading: z.object({ customer: z.array(z.string()), gastech: z.array(z.string()) }),
  skidsOnHold: z.array(z.string()),
  skidsLoaded: z.object({ customer: z.array(z.string()), gastech: z.array(z.string()) }),
  skidsEmpty: z.object({ customer: z.array(z.string()), gastech: z.array(z.string()) }),
  newLoadedSkids: z.array(z.string()),
  skidsForWashing: z.array(z.object({ skidNum: z.string(), fillState: z.string() })),
  trucksOnGround: z.array(z.string()),
  standbyTrucks: z.array(z.string()),
  trucksInTransit: z.array(z.object({ truckNum: z.string(), customer: z.string() })),
  returningTrucks: z.array(z.string()),
  maintenance: z.object({ skids: z.array(z.string()), trucks: z.array(z.string()) }),
});

export const PlantReportMetricsSchema = z.object({
  inletPressureBar: z.number().optional(),
  loadingPressureBar: z.number().optional(),
  landingGearBox: z.object({
    loadingAndWashingBay: z.number().optional(),
    workshop: z.number().optional(),
    wooden: z.number().optional(),
  }).optional(),
  newChassisInPlant: z.number().optional(),
  compressors: z.record(z.string(), z.string()).optional(),
  extraFields: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

export const PlantReportSchema = z.object({
  id: z.string(),
  shiftDate: z.string(),
  officersOnDuty: z.string(),
  metrics: PlantReportMetricsSchema,
  fleetSnapshot: PlantFleetSnapshotSchema.nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});

export const PlantYardSkidSchema = z.object({
  id: z.string(),
  skidNum: z.string(),
  fillState: z.enum(['empty', 'loading', 'loaded']),
  bayState: z.enum(['idle', 'on_hold', 'washing']),
  isNew: z.boolean(),
  customerName: z.string().nullable(),
});

export const PlantDashboardDataSchema = z.object({
  fleetSnapshot: PlantFleetSnapshotSchema,
  plantSkids: z.array(PlantYardSkidSchema),
  previousMetrics: PlantReportMetricsSchema.nullable(),
  previousOfficers: z.string(),
  reports: z.array(PlantReportSchema),
});

export const PlantDashboardResponseSchema = z.object({
  data: PlantDashboardDataSchema,
  meta: z.object({ pagination: PaginationMetaSchema }).optional(),
});

export type PlantFleetSnapshot = z.infer<typeof PlantFleetSnapshotSchema>;
export type PlantReportMetrics = z.infer<typeof PlantReportMetricsSchema>;
export type PlantReport = z.infer<typeof PlantReportSchema>;
export type PlantDashboardData = z.infer<typeof PlantDashboardDataSchema>;
