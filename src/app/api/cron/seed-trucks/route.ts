// app/api/cron/seed-trucks/route.ts
import { NextResponse } from 'next/server';
import { HclTruckData, insertTrucks } from '@/services/trucks/queries';

export async function GET(request: Request) {
  // Optional: protect cron route with a secret header
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(`${process.env.APP_URL}/api/hcltracker/vehicles`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch fleet feed');

    const json: HclTruckData = await res.json();
    const newTrucks = json.data || [];

      if (newTrucks.length > 0) {
          await insertTrucks(newTrucks);
    }

    return NextResponse.json({ seededCount: newTrucks.length });
  } catch (error) {
    console.error('Seed trucks cron error:', error);
    return NextResponse.json({ error: 'Failed to seed trucks' }, { status: 500 });
  }
}
