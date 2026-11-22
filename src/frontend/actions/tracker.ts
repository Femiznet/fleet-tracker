import { z } from 'zod';
import { parseResponse, requestJson } from '@/frontend/actions/http';
import { TrackerDataSchema } from '@/frontend/types/tracker';

export async function getTrackerData() {
  const response = parseResponse(
    await requestJson('/api/tracker'),
    z.object({ data: TrackerDataSchema }),
    'The truck and skid tracker returned an invalid response.'
  );
  return response.data;
}
