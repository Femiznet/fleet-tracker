// app/api/hcltracker/vehicles/route.ts
import { NextRequest } from 'next/server';
import { getCleanVehicles } from '@/lib/hcltracker/vehicles';
import { apiError, apiSuccess } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page');
  const limit = searchParams.get('per_page');

  if (!page || !limit) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Both page and per_page query parameters are required.' }, 400);
  }

  try {
    const vehicles = await getCleanVehicles(page, limit);
    return apiSuccess(vehicles);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return apiError({ code: 'UPSTREAM_ERROR', message }, 502);
  }
}
