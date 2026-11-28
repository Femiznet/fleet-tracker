// app/api/cron/seed-trucks/route.ts
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-errors';
import { cronAuthorizationError } from '@/lib/cron-auth';
import { getCleanVehicles } from '@/lib/hcltracker/vehicles';
import {
  insertTrucks,
  trucksFeatureAvailable,
  trucksFeatureUnavailableResponse,
} from '@/generated/trucks-feature';

export async function GET(request: Request) {
  const authorizationError = cronAuthorizationError(request);
  if (authorizationError) return authorizationError;

  if (!trucksFeatureAvailable) {
    return NextResponse.json(trucksFeatureUnavailableResponse, {
      status: 503,
    });
  }

  try {
    const vehicles = await getCleanVehicles('1', '100');
    const trucksToSeed = vehicles
      .filter(
        (vehicle): vehicle is typeof vehicle & { lat: number; lon: number } =>
          vehicle.lat !== null &&
          vehicle.lon !== null &&
          Number.isFinite(vehicle.lat) &&
          Number.isFinite(vehicle.lon),
      )
      .map((vehicle) => ({
        truckNum: vehicle.plateNumber.trim(),
        lat: vehicle.lat,
        lon: vehicle.lon,
        speed: parseInt(String(vehicle.speed), 10) || 0,
      }));
    const inserted = await insertTrucks(trucksToSeed);
    return NextResponse.json({ seededCount: inserted.length });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to seed trucks');
  }
}
