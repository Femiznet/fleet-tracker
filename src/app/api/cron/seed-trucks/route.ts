// app/api/cron/seed-trucks/route.ts
import { HclTruckData, insertTrucks } from '@/services/trucks/queries';
import { apiError, apiSuccess } from '@/lib/api-response';

export async function GET(request: Request) {
  // Optional: protect cron route with a secret header
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401);
  }

  try {
    const res = await fetch(`${process.env.APP_URL}/api/hcltracker/vehicles?page=1&per_page=25`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch fleet feed');

    const json = await res.json() as HclTruckData;
    const newTrucks = json.data || [];

      if (newTrucks.length > 0) {
          await insertTrucks(newTrucks);
    }

    return apiSuccess({ seededCount: newTrucks.length });
  } catch (error) {
    console.error('Seed trucks cron error:', error);
    return apiError({ code: 'SEED_FAILED', message: 'Failed to seed trucks' }, 500);
  }
}
