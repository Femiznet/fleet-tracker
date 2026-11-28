// app/api/cron/sync-locations/route.ts
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-errors';
import { cronAuthorizationError } from '@/lib/cron-auth';
import {
  processBatchTruckLocations,
  trucksFeatureAvailable,
  trucksFeatureUnavailableResponse,
} from '@/generated/trucks-feature';
import { getCleanAddress } from '@/lib/hcltracker/address';
import { getCleanVehicles } from '@/lib/hcltracker/vehicles';

export async function GET(request: Request) {
  const authorizationError = cronAuthorizationError(request);
  if (authorizationError) return authorizationError;

  if (!trucksFeatureAvailable) {
    return NextResponse.json(trucksFeatureUnavailableResponse, {
      status: 503,
    });
  }

  try {
    const newTrucks = await getCleanVehicles('1', '100');

    const data = newTrucks
      .filter(
        (truck): truck is typeof truck & { lat: number; lon: number } =>
          truck.lat !== null &&
          truck.lon !== null &&
          Number.isFinite(truck.lat) &&
          Number.isFinite(truck.lon),
      )
      .map((truck) => ({
        truckNum: truck.plateNumber.trim(),
        newLat: truck.lat,
        newLon: truck.lon,
        speed: parseInt(String(truck.speed), 10) || 0,
      }));

    await processBatchTruckLocations(data, getCleanAddress);

    return NextResponse.json({ processed: data.length });
  } catch (error) {
    return apiErrorResponse(error, 'Sync locations cron failed');
  }
}
