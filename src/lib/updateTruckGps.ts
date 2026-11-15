// lib/updateTruckGps.ts
import { db } from '@/db';
import { trucks } from '@/db/schema';
import { getDistanceMeters, learnGeofencePoint } from '@/lib/geofence';
import { eq } from 'drizzle-orm';

const APP_URL = process.env.APP_URL;
const MOVEMENT_THRESHOLD_METERS = 50;

interface LocationApiResponse {
  data?: {
    lat: string;
    lon: string;
    address?: string;
  };
}

export async function resolveLocationFromApi(lat: number, lon: number): Promise<string | null> {
  try {
    // Fixed: added missing "lat=$"
    const res = await fetch(`${APP_URL}/api/hcltracker/address?lat=${lat}&lon=${lon}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const json: LocationApiResponse = await res.json();
    const address = json.data?.address?.trim();

    return address || null;
  } catch (error) {
    console.error('Failed to resolve location from API:', error);
    return null;
  }
}

export async function processTruckLocationUpdate(
  truckNum: string,
  newLat: number,
  newLon: number,
  speed: number,
) {
  const [existingTruck] = await db
    .select()
    .from(trucks)
    .where(eq(trucks.truckNum, truckNum));

  if (!existingTruck) return;

  const distanceMoved = getDistanceMeters(
    existingTruck.lat,
    existingTruck.lon,
    newLat,
    newLon
  );

  // Skip API call if truck moved less than 50m and already has a valid location
  if (
    distanceMoved < MOVEMENT_THRESHOLD_METERS &&
    existingTruck.currentLoc !== 'pending'
  ) {
    await db
      .update(trucks)
      .set({ lat: newLat, lon: newLon, speed })
      .where(eq(trucks.truckNum, truckNum));
    return;
  }

  const resolvedName = await resolveLocationFromApi(newLat, newLon);

  // Always update coordinates; only overwrite currentLoc if the API succeeded
  await db
    .update(trucks)
    .set({
      lat: newLat,
      lon: newLon,
      ...(resolvedName ? { currentLoc: resolvedName } : {}),
      speed,
    })
    .where(eq(trucks.truckNum, truckNum));

  // Teach geofenceZones only when we got a real address back
  if (resolvedName) {
    await learnGeofencePoint(resolvedName, newLat, newLon);
  }
}
