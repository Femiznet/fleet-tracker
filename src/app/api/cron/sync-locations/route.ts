// app/api/cron/sync-locations/route.ts
import { NextResponse } from 'next/server';
import { processTruckLocationUpdate } from '@/lib/updateTruckGps';
import { getCleanVehicles } from '@/lib/hcltracker/vehicles';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {

    // Directly calls HCL Tracker without an internal localhost HTTP request
    const newTrucks = await getCleanVehicles('1', '100');
    
    // Filter out any trucks with missing GPS coordinates (lat === null || lon === null)
    const data = newTrucks.filter(
      (truck): truck is typeof truck & { lat: number; lon: number } =>
        truck.lat !== null && truck.lon !== null
    );
        
    const BATCH_SIZE = 5;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((truck) =>
          processTruckLocationUpdate({
            truckNum: truck.plateNumber.trim(),
            newLat: truck.lat,
            newLon: truck.lon,
            speed: parseInt(String(truck.speed), 10) || 0
}          )
        )
      );
    }

    return NextResponse.json({ processed: data.length });
  } catch (error) {
    console.error('Sync locations cron error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
