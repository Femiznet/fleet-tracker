import { inArray, sql } from 'drizzle-orm';
import { db } from '@fleet/database';
import { geofenceZones, trucks } from '@fleet/database/schema';
import {
  findMatchingGeofence,
  getDistanceMeters,
  learnGeofencePointsBatch,
} from './geofence';

const MOVEMENT_THRESHOLD_METERS = 150;
const ADDRESS_LOOKUP_CONCURRENCY = 3;

export interface TruckLocationInput {
  truckNum: string;
  newLat: number;
  newLon: number;
  speed: number;
}

export type ResolveTruckAddress = (
  lat: number,
  lon: number,
) => Promise<string | null>;

export async function processBatchTruckLocations(
  inputs: TruckLocationInput[],
  resolveAddress: ResolveTruckAddress,
): Promise<void> {
  if (inputs.length === 0) return;

  const truckNums = inputs.map((truck) => truck.truckNum);
  const [existingTrucks, allZones] = await Promise.all([
    db.select().from(trucks).where(inArray(trucks.truckNum, truckNums)),
    db.select().from(geofenceZones),
  ]);

  const truckMap = new Map(
    existingTrucks.map((truck) => [truck.truckNum, truck]),
  );
  const pendingAddressBuckets = new Map<string, { lat: number; lon: number }>();
  const plan = inputs
    .map((input) => {
      const existing = truckMap.get(input.truckNum);
      if (!existing) return null;

      const distanceMoved = getDistanceMeters(
        existing.lat,
        existing.lon,
        input.newLat,
        input.newLon,
      );

      if (
        distanceMoved < MOVEMENT_THRESHOLD_METERS &&
        existing.currentLoc !== 'pending'
      ) {
        return {
          input,
          existing,
          resolvedLocation: existing.currentLoc,
          bucketKey: null,
        };
      }

      const localMatch = findMatchingGeofence(
        allZones,
        input.newLat,
        input.newLon,
      );
      if (localMatch) {
        return {
          input,
          existing,
          resolvedLocation: localMatch,
          bucketKey: null,
        };
      }

      const bucketKey = `${input.newLat.toFixed(3)},${input.newLon.toFixed(3)}`;
      if (!pendingAddressBuckets.has(bucketKey)) {
        pendingAddressBuckets.set(bucketKey, {
          lat: input.newLat,
          lon: input.newLon,
        });
      }

      return { input, existing, resolvedLocation: null, bucketKey };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (plan.length === 0) return;

  const addressEntries = Array.from(pendingAddressBuckets.entries());
  const addressResults = new Map<string, string | null>();

  for (
    let index = 0;
    index < addressEntries.length;
    index += ADDRESS_LOOKUP_CONCURRENCY
  ) {
    const chunk = addressEntries.slice(
      index,
      index + ADDRESS_LOOKUP_CONCURRENCY,
    );
    await Promise.all(
      chunk.map(async ([key, coordinates]) => {
        const address = await resolveAddress(coordinates.lat, coordinates.lon);
        addressResults.set(key, address);
      }),
    );
  }

  const observations: Array<{
    geofenceName: string;
    lat: number;
    lon: number;
  }> = [];

  const valueRows = plan.map(
    ({ input, existing, resolvedLocation, bucketKey }) => {
      let finalLocation = resolvedLocation;

      if (bucketKey !== null) {
        const address = addressResults.get(bucketKey) ?? null;
        finalLocation = address ?? existing.currentLoc;
        if (address) {
          observations.push({
            geofenceName: address,
            lat: input.newLat,
            lon: input.newLon,
          });
        }
      }

      return sql`(${input.truckNum}, ${input.newLat}::double precision, ${input.newLon}::double precision, ${input.speed}::integer, ${finalLocation})`;
    },
  );

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

  await learnGeofencePointsBatch(allZones, observations);
}
