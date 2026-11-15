// app/actions/getTrucksAtZone.ts
'use server';

import { db } from '@/db';
import { trucks, geofenceZones } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getDistanceMeters, learnGeofencePoint } from '@/lib/geofence';
import { Truck } from '@/db/schema/trucks';
import { resolveLocationFromApi } from '@/lib/updateTruckGps';

const BATCH_SIZE = 5; // Safe concurrency limit so you don't overwhelm your API

export async function getTrucksAtZone(targetgeofenceName: string) {
  // 1. Fetch the target zone and all trucks
  const [[zone], allTrucks] = await Promise.all([
    db.select().from(geofenceZones).where(eq(geofenceZones.geofenceName, targetgeofenceName)),
    db.select().from(trucks),
  ]);

  if (!zone) {
    throw new Error(`Unknown geofence zone: ${targetgeofenceName}`);
  }

  // 2. Decide which trucks actually need an API check
  const isZoneLearned =
    zone.centerLat !== null &&
    zone.centerLon !== null &&
    zone.radiusMeters !== null;

  const candidateTrucks = isZoneLearned
    ? allTrucks.filter(
        (truck) =>
          getDistanceMeters(
            zone.centerLat!,
            zone.centerLon!,
            truck.lat,
            truck.lon
          ) <= zone.radiusMeters!
      )
    : allTrucks; // Zone not learned yet: check all trucks once to discover it

  const trucksInZone : Truck[] = [];

  // 3. Process only the candidate trucks in batches of 5
  for (let i = 0; i < candidateTrucks.length; i += BATCH_SIZE) {
    const batch = candidateTrucks.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (truck) => {
        const resolvedName = await resolveLocationFromApi(truck.lat, truck.lon);

        if (!resolvedName) return;

        // Cross-learn: if this truck is at ANY whitelisted customer zone, save its point!
        await learnGeofencePoint(resolvedName, truck.lat, truck.lon);

        // Optional: update the truck's cached location column if you added one
        await db.update(trucks).set({ currentLoc: resolvedName }).where(eq(trucks.id, truck.id));

        if (resolvedName === targetgeofenceName) {
          trucksInZone.push(truck);
        }
      })
    );
  }

  return trucksInZone;
}
