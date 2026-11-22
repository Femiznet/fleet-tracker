// lib/updateTruckGps.ts
import { db } from '@/backend/db';
import { geofenceZones, trucks } from '@/backend/db/schema';
import {
  findMatchingGeofence,
  getDistanceMeters,
  learnGeofencePointsBatch,
} from '@/backend/lib/geofence';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getCleanAddress } from '@/backend/lib/hcltracker/address';

const APP_URL = process.env.APP_URL;
const MOVEMENT_THRESHOLD_METERS = 150; // Raised from 50m to cut highway/traffic noise

export interface TruckLocationInput {
  truckNum: string;
  newLat: number;
  newLon: number;
  speed: number;
}

interface LocationApiResponse {
  data?: {
    lat: string;
    lon: string;
    address?: string;
  };
}

export async function resolveLocationFromApi(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(`${APP_URL}/api/hcltracker/address?lat=${lat}&lon=${lon}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const json: LocationApiResponse = await res.json();
    return json.data?.address?.trim() || null;
  } catch (error) {
    console.error('Failed to resolve location from API:', error);
    return null;
  }
}

export async function processBatchTruckLocations(inputs: TruckLocationInput[]) {
  if (inputs.length === 0) return;

  // 1. Fetch matching trucks AND all geofence zones in parallel (2 queries total)
  const truckNums = inputs.map((t) => t.truckNum);
  const [existingTrucks, allZones] = await Promise.all([
    db.select().from(trucks).where(
      and(
        inArray(trucks.truckNum, truckNums),
        eq(trucks.group, 'GASTECH VEHICLES')
      )
    ),
    db.select().from(geofenceZones),
  ]);

  const truckMap = new Map(existingTrucks.map((t) => [t.truckNum, t]));

  // 2. Match against local geofences first; queue only genuinely unknown spots for API
  const pendingApiBuckets = new Map<string, { lat: number; lon: number }>();
  const plan = inputs
    .map((input) => {
      const existing = truckMap.get(input.truckNum);
      if (!existing) return null;

      const distanceMoved = getDistanceMeters(
        existing.lat,
        existing.lon,
        input.newLat,
        input.newLon
      );

      // Stationary (< 150m) with a known location: keep existing location
      if (
        distanceMoved < MOVEMENT_THRESHOLD_METERS &&
        existing.currentLoc !== 'pending'
      ) {
        return { input, existing, resolvedLoc: existing.currentLoc, bucketKey: null };
      }

      // Check local learned geofences BEFORE making an external HTTP call (0ms)
      const localMatch = findMatchingGeofence(allZones, input.newLat, input.newLon);
      if (localMatch) {
        return { input, existing, resolvedLoc: localMatch, bucketKey: null };
      }

      // Deduplicate API lookups within ~110m (3 decimal places)
      const bucketKey = `${input.newLat.toFixed(3)},${input.newLon.toFixed(3)}`;
      if (!pendingApiBuckets.has(bucketKey)) {
        pendingApiBuckets.set(bucketKey, { lat: input.newLat, lon: input.newLon });
      }

      return { input, existing, resolvedLoc: null, bucketKey };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (plan.length === 0) return;

  // 3. Call the address API only once per unique unmapped coordinate bucket
  // Inside processBatchTruckLocations when resolving pendingApiBuckets:
  const entries = Array.from(pendingApiBuckets.entries());
  const apiResults = new Map<string, string | null>();
  const CONCURRENCY = 3;
  
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const chunk = entries.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async ([key, coords]) => {
        const address = await getCleanAddress(coords.lat, coords.lon);
        apiResults.set(key, address);
      })
    );
  }
  
  // 4. Build final updates + new geofence observations
  const observations: Array<{ geofenceName: string; lat: number; lon: number }> = [];

  const valueRows = plan.map(({ input, existing, resolvedLoc, bucketKey }) => {
    let finalLoc = resolvedLoc;

    if (bucketKey !== null) {
      const apiName = apiResults.get(bucketKey) ?? null;
      finalLoc = apiName ?? existing.currentLoc;
      if (apiName) {
        observations.push({
          geofenceName: apiName,
          lat: input.newLat,
          lon: input.newLon,
        });
      }
    }

    return sql`(${input.truckNum}, ${input.newLat}::double precision, ${input.newLon}::double precision, ${input.speed}::integer, ${finalLoc})`;
  });

  // 5. Update ALL trucks in ONE single SQL query
  await db.execute(sql`
    UPDATE ${trucks} AS t
    SET
      lat = v.lat,
      lon = v.lon,
      speed = v.speed,
      current_loc = v.current_loc
    FROM (VALUES ${sql.join(valueRows, sql`, `)}) AS v(truck_num, lat, lon, speed, current_loc)
    WHERE t.truck_num = v.truck_num
  `);

  // 6. Batch-update any newly learned geofence zones
  await learnGeofencePointsBatch(allZones, observations);
}
