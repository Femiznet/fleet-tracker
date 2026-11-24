// app/api/cron/sync-locations/route.ts
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-errors';
import { processBatchTruckLocations } from '@/lib/updateTruckGps';
import { getCleanVehicles } from '@/lib/hcltracker/vehicles';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  

    return NextResponse.json({ processed: data.length });
  } catch (error) {
    return apiErrorResponse(error, 'Sync locations cron failed');
  }
}
