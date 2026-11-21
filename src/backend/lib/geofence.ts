// lib/geofence.ts
import { db } from '@/backend/db';
import { geofenceZones } from '@/backend/db/schema';
import { eq } from 'drizzle-orm';

const SAFETY_BUFFER_METERS = 500;
const MAX_CLUSTER_DISTANCE_METERS = 10000;
const MIN_POINT_SPACING_METERS = 30;
const MAX_SAMPLE_POINTS = 50;

export type GeofenceZone = typeof geofenceZones.$inferSelect;

export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
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
 * Checks in memory if (lat, lon) falls inside any already-learned geofence zone.
 * Returns the closest matching zone name, or null if outside all known zones.
 */
export function findMatchingGeofence(
  zones: GeofenceZone[],
  lat: number,
  lon: number
): string | null {
  let closestZone: string | null = null;
  let minDistance = Infinity;

  for (const zone of zones) {
    if (
      zone.centerLat === null ||
      zone.centerLon === null ||
      zone.radiusMeters === null
    ) {
      continue;
    }

    const dist = getDistanceMeters(zone.centerLat, zone.centerLon, lat, lon);
    if (dist <= zone.radiusMeters && dist < minDistance) {
      minDistance = dist;
      closestZone = zone.geofenceName;
    }
  }

  return closestZone;
}

/**
 * Updates pre-seeded geofence zones in batch without race conditions.
 */
export async function learnGeofencePointsBatch(
  zones: GeofenceZone[],
  observations: Array<{ geofenceName: string; lat: number; lon: number }>
): Promise<void> {
  if (observations.length === 0) return;

  const zoneMap = new Map(zones.map((z) => [z.geofenceName, { ...z }]));
  const dirtyZoneIds = new Set<string>();

  for (const { geofenceName, lat, lon } of observations) {
    const zone = zoneMap.get(geofenceName);
    if (!zone) continue;

    if (zone.centerLat === null || zone.centerLon === null) {
      zone.centerLat = lat;
      zone.centerLon = lon;
      zone.radiusMeters = SAFETY_BUFFER_METERS;
      zone.samplePoints = [{ lat, lon }];
      dirtyZoneIds.add(zone.id);
      continue;
    }

    const distFromCenter = getDistanceMeters(zone.centerLat, zone.centerLon, lat, lon);
    if (distFromCenter > MAX_CLUSTER_DISTANCE_METERS) continue;
    if (zone.samplePoints.length >= MAX_SAMPLE_POINTS) continue;

    const isTooClose = zone.samplePoints.some(
      (p) => getDistanceMeters(p.lat, p.lon, lat, lon) < MIN_POINT_SPACING_METERS
    );
    if (isTooClose) continue;

    const updatedPoints = [...zone.samplePoints, { lat, lon }];
    const newCenterLat =
      updatedPoints.reduce((sum, p) => sum + p.lat, 0) / updatedPoints.length;
    const newCenterLon =
      updatedPoints.reduce((sum, p) => sum + p.lon, 0) / updatedPoints.length;
    const maxDist = Math.max(
      ...updatedPoints.map((p) =>
        getDistanceMeters(newCenterLat, newCenterLon, p.lat, p.lon)
      )
    );

    zone.centerLat = newCenterLat;
    zone.centerLon = newCenterLon;
    zone.radiusMeters = maxDist + SAFETY_BUFFER_METERS;
    zone.samplePoints = updatedPoints;
    dirtyZoneIds.add(zone.id);
  }

  if (dirtyZoneIds.size === 0) return;

  await Promise.all(
    Array.from(dirtyZoneIds).map((id) => {
      const z = Array.from(zoneMap.values()).find((item) => item.id === id)!;
      return db
        .update(geofenceZones)
        .set({
          centerLat: z.centerLat,
          centerLon: z.centerLon,
          radiusMeters: z.radiusMeters,
          samplePoints: z.samplePoints,
          updatedAt: new Date(),
        })
        .where(eq(geofenceZones.id, id));
    })
  );
}
