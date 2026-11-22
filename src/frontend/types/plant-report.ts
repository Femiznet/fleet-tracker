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
  landingGearBox: z
    .object({
      loadingAndWashingBay: z.number().optional(),
      workshop: z.number().optional(),
      wooden: z.number().optional(),
    })
    .optional(),
  newChassisInPlant: z.number().optional(),
  compressors: z.record(z.string(), z.string()).optional(),
  extraFields: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

export const PlantYardSkidSchema = z.object({
  id: z.string(),
  skidNum: z.string(),
  fillState: z.enum(['empty', 'loading', 'loaded', 'on_hold']).nullable(),
  bay: z.enum(['washing_bay', 'loading_bay', 'parking_bay']).nullable(),
  isNew: z.boolean(),
  owner: z.enum(['customer', 'gastech']),
  isOnMaintenance: z.boolean().nullable(),
  maintenanceNote: z.string().nullable(),
  customerName: z.string().nullable(),
  note: z.string().nullable(),
});

export const PlantDashboardDataSchema = z.object({
  fleetSnapshot: PlantFleetSnapshotSchema,
  latestReport: z
    .object({
      id: z.string(),
      officersOnDuty: z.string(),
      metrics: PlantReportMetricsSchema,
      fleetSnapshot: PlantFleetSnapshotSchema.nullable(),
      notes: z.string().nullable(),
      createdAt: z.string(),
      formattedMessage: z.string().nullable(),
    })
    .nullable(),
  plantSkids: z.array(PlantYardSkidSchema),
  plantTrucks: z.array(
    z.object({
      id: z.string(),
      truckNum: z.string(),
      currentLoc: z.string(),
      status: z.enum(['available', 'in_transit', 'standby', 'at_customer', 'maintenance']),
      isStandby: z.boolean().nullable(),
      isOnMaintenance: z.boolean().nullable(),
      maintenanceNote: z.string().nullable(),
      note: z.string().nullable(),
    })
  ),
});

export const PlantDashboardResponseSchema = z.object({
  data: PlantDashboardDataSchema,
  meta: z.object({ pagination: PaginationMetaSchema }).optional(),
});

export const PlantReportSubmissionResponseSchema = z.object({
  data: z.object({
    snapshot: PlantFleetSnapshotSchema,
    formattedMessage: z.string(),
    report: z.object({ id: z.string(), createdAt: z.string() }),
  }),
});

export type PlantYardSkid = z.infer<typeof PlantYardSkidSchema>;
export type PlantFleetSnapshot = z.infer<typeof PlantFleetSnapshotSchema>;
export type PlantReportMetrics = z.infer<typeof PlantReportMetricsSchema>;
export type PlantDashboardData = z.infer<typeof PlantDashboardDataSchema>;
export type PlantReportSubmission = z.infer<typeof PlantReportSubmissionResponseSchema>['data'];
export type PlantSkidUpdate = {
  id: string;
  fillState: 'empty' | 'loading' | 'loaded' | 'on_hold';
  bay: 'washing_bay' | 'loading_bay' | 'parking_bay';
  note?: string | null;
};
