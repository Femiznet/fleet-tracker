import { z } from 'zod';
import { parseResponse, requestJson } from '@/frontend/actions/http';

const OperationsOverviewSchema = z.object({
  trucks: z.object({
    total: z.number(),
    atPlant: z.number(),
    inTransit: z.number(),
    standby: z.number(),
    maintenance: z.number(),
  }),
  skids: z.object({
    total: z.number(),
    atPlant: z.number(),
    inTransit: z.number(),
    atCustomer: z.number(),
    maintenance: z.number(),
  }),
  geofences: z.array(
    z.object({
      name: z.string(),
      trucks: z.number(),
      configured: z.boolean(),
    })
  ),
  trucksOutsideGeofences: z.number(),
  trucksWithoutGps: z.number(),
});

export type OperationsOverviewData = z.infer<typeof OperationsOverviewSchema>;

export async function getOperationsOverview() {
  const response = parseResponse(
    await requestJson('/api/operations-overview'),
    z.object({ data: OperationsOverviewSchema }),
    'The operations overview returned an invalid response.'
  );
  return response.data;
}
