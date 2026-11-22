// app/api/cron/sync-locations/route.ts
import { processBatchTruckLocations } from '@/backend/lib/updateTruckGps';
import { getCleanVehicles } from '@/backend/lib/hcltracker/vehicles';
import { apiError, apiSuccess } from '@/backend/lib/api-response';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401);
  }

  try {
    const newTrucks = await getCleanVehicles('1', '100');

    const data = newTrucks
    .filter(
      (truck): truck is typeof truck & { lat: number; lon: number } =>
        truck.lat !== null && truck.lon !== null
    )
    .map((truck) => ({
      truckNum: truck.plateNumber.trim(),
      newLat: truck.lat,
      newLon: truck.lon,
      speed: parseInt(String(truck.speed), 10) || 0,
    }));
  
  await processBatchTruckLocations(data);
  
    return apiSuccess({ processed: data.length });
  } catch (error) {
    console.error('Sync locations cron error:', error);
    return apiError({ code: 'SYNC_FAILED', message: 'Sync failed' }, 500);
  }
}
