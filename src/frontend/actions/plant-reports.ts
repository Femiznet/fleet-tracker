import { parseResponse, requestJson } from '@/frontend/actions/http';
import {
  PlantDashboardResponseSchema,
  PlantReportSubmissionResponseSchema,
  type PlantReportMetrics,
  type PlantSkidUpdate,
} from '@/frontend/types/plant-report';
import { z } from 'zod';

export async function getPlantDashboard() {
  const response = parseResponse(
    await requestJson('/api/plant-reports?page=1&limit=1'),
    PlantDashboardResponseSchema,
    'The plant status returned an invalid response.'
  );
  return response.data;
}

export async function submitPlantReport(input: {
  officersOnDuty: string;
  metrics: PlantReportMetrics;
  skidUpdates: PlantSkidUpdate[];
  notes?: string;
}) {
  const response = parseResponse(
    await requestJson('/api/plant-reports', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
    PlantReportSubmissionResponseSchema,
    'Plant report submission returned an invalid response.'
  );
  return response.data;
}

export async function updateSkidStatus(
  id: string,
  input: {
    fillState: 'empty' | 'loading' | 'loaded' | 'on_hold';
    bay: 'washing_bay' | 'loading_bay' | 'parking_bay';
    isOnMaintenance?: boolean;
    maintenanceNote?: string | null;
    note?: string | null;
  }
) {
  const response = parseResponse(
    await requestJson(`/api/skids/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
    z.object({
      data: z.object({
        skid: z.object({ id: z.string() }),
        status: z.object({
          fillState: z.enum(['empty', 'loading', 'loaded', 'on_hold']),
          bay: z.enum(['washing_bay', 'loading_bay', 'parking_bay']),
          isOnMaintenance: z.boolean().optional(),
          maintenanceNote: z.string().nullable().optional(),
          note: z.string().nullable(),
        }),
      }),
    }),
    'Skid status update returned an invalid response.'
  );
  return response.data;
}
