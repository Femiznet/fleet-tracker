// app/api/cron/sync-locations/route.ts
import { NextResponse } from 'next/server';
import { processTruckLocationUpdate } from '@/lib/updateTruckGps';
import { HclTruckData } from '@/services/trucks/queries';


export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
      const res = await fetch(
          `${process.env.APP_URL}/api/hcltracker/vehicles?page=1&per_page=5`,
          { cache: 'no-store' }
      );
    const { data = [] }: HclTruckData = await res.json();
    
    const BATCH_SIZE = 5;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((truck) =>
          processTruckLocationUpdate(
            truck.plateNumber.trim(),
            truck.lat,
            truck.lon,
            parseInt(truck.speed, 10) || 0
          )
        )
      );
    }

    return NextResponse.json({ processed: data.length });
  } catch (error) {
    console.error('Sync locations cron error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
