// lib/geofence.ts
import { db } from '@/db';
import { geofenceZones } from '@/db/schema';
import { eq } from 'drizzle-orm';

const SAFETY_BUFFER_METERS = 500; // Extra margin around known points
const MAX_CLUSTER_DISTANCE_METERS = 10000; // 10km guard against distant outliers
const MIN_POINT_SPACING_METERS = 30; // Avoid saving clustered duplicate GPS pings
const MAX_SAMPLE_POINTS = 50; // Cap stored points per zone

/**
 * Calculates the great-circle distance in meters between two GPS coordinates.
 */
export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Updates a pre-seeded geofence zone when your API confirms a truck is inside it.
 * Ignores any geofenceName not present in the geofenceZones whitelist table.
 */
export async function learnGeofencePoint(
  geofenceName: string,
  lat: number,
  lon: number
): Promise<void> {
  // 1. Check if this geofenceName is in your pre-seeded whitelist
    const [zone] = await db
        .select()
        .from(geofenceZones)
        .where(eq(geofenceZones.geofenceName, geofenceName));

  // Ignore highway addresses or unknown locations
  if (!zone) return;

  // 2. First time a truck ever visits this zone: initialize center & radius
  if (zone.centerLat === null || zone.centerLon === null) {
    await db
      .update(geofenceZones)
      .set({
        centerLat: lat,
        centerLon: lon,
        radiusMeters: SAFETY_BUFFER_METERS,
        samplePoints: [{ lat, lon }],
        updatedAt: new Date(),
      })
      .where(eq(geofenceZones.id, zone.id));
    return;
  }

  // 3. Outlier guard: ignore points >10km from the existing center
  const distFromCenter = getDistanceMeters(zone.centerLat, zone.centerLon, lat, lon);
  if (distFromCenter > MAX_CLUSTER_DISTANCE_METERS) return;

  // 4. Stop adding points once we have 50 well-spaced samples
  if (zone.samplePoints.length >= MAX_SAMPLE_POINTS) return;

  // 5. Only add this coordinate if it's at least 30m away from existing sample points
  const isTooClose = zone.samplePoints.some(
    (p) => getDistanceMeters(p.lat, p.lon, lat, lon) < MIN_POINT_SPACING_METERS
  );
  if (isTooClose) return;

  const updatedPoints = [...zone.samplePoints, { lat, lon }];

  // 6. Recalculate true center (average lat & lon of all sample points)
  const newCenterLat =
    updatedPoints.reduce((sum, p) => sum + p.lat, 0) / updatedPoints.length;
  const newCenterLon =
    updatedPoints.reduce((sum, p) => sum + p.lon, 0) / updatedPoints.length;

  // 7. Recalculate radius (farthest sample point from new center + safety buffer)
  const maxDist = Math.max(
    ...updatedPoints.map((p) =>
      getDistanceMeters(newCenterLat, newCenterLon, p.lat, p.lon)
    )
  );

  await db
    .update(geofenceZones)
    .set({
      centerLat: newCenterLat,
      centerLon: newCenterLon,
      radiusMeters: maxDist + SAFETY_BUFFER_METERS,
      samplePoints: updatedPoints,
      updatedAt: new Date(),
    })
    .where(eq(geofenceZones.id, zone.id));
}
