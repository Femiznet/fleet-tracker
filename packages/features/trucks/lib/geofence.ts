import { db } from '@fleet/database';
import { geofenceZones } from '@fleet/database/schema';
import { eq } from 'drizzle-orm';

const SAFETY_BUFFER_METERS = 500;
const MAX_CLUSTER_DISTANCE_METERS = 10000;
const MIN_POINT_SPACING_METERS = 30;
const MAX_SAMPLE_POINTS = 50;

type GeofenceZone = typeof geofenceZones.$inferSelect;

export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusMeters = 6371e3;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const latitudeDifference = toRadians(lat2 - lat1);
  const longitudeDifference = toRadians(lon2 - lon1);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(longitudeDifference / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findMatchingGeofence(
  zones: GeofenceZone[],
  lat: number,
  lon: number,
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

    const distance = getDistanceMeters(
      zone.centerLat,
      zone.centerLon,
      lat,
      lon,
    );
    if (distance <= zone.radiusMeters && distance < minDistance) {
      minDistance = distance;
      closestZone = zone.geofenceName;
    }
  }

  return closestZone;
}

export async function learnGeofencePointsBatch(
  zones: GeofenceZone[],
  observations: Array<{ geofenceName: string; lat: number; lon: number }>,
): Promise<void> {
  if (observations.length === 0) return;

  const zoneMap = new Map(
    zones.map((zone) => [zone.geofenceName, { ...zone }]),
  );
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

    const distanceFromCenter = getDistanceMeters(
      zone.centerLat,
      zone.centerLon,
      lat,
      lon,
    );
    if (distanceFromCenter > MAX_CLUSTER_DISTANCE_METERS) continue;
    if (zone.samplePoints.length >= MAX_SAMPLE_POINTS) continue;

    const isTooClose = zone.samplePoints.some(
      (point) =>
        getDistanceMeters(point.lat, point.lon, lat, lon) <
        MIN_POINT_SPACING_METERS,
    );
    if (isTooClose) continue;

    const updatedPoints = [...zone.samplePoints, { lat, lon }];
    const newCenterLat =
      updatedPoints.reduce((sum, point) => sum + point.lat, 0) /
      updatedPoints.length;
    const newCenterLon =
      updatedPoints.reduce((sum, point) => sum + point.lon, 0) /
      updatedPoints.length;
    const maxDistance = Math.max(
      ...updatedPoints.map((point) =>
        getDistanceMeters(newCenterLat, newCenterLon, point.lat, point.lon),
      ),
    );

    zone.centerLat = newCenterLat;
    zone.centerLon = newCenterLon;
    zone.radiusMeters = maxDistance + SAFETY_BUFFER_METERS;
    zone.samplePoints = updatedPoints;
    dirtyZoneIds.add(zone.id);
  }

  if (dirtyZoneIds.size === 0) return;

  await Promise.all(
    Array.from(dirtyZoneIds).map((id) => {
      const zone = Array.from(zoneMap.values()).find((item) => item.id === id);
      if (!zone) {
        throw new Error(`Updated geofence zone ${id} could not be retrieved`);
      }

      return db
        .update(geofenceZones)
        .set({
          centerLat: zone.centerLat,
          centerLon: zone.centerLon,
          radiusMeters: zone.radiusMeters,
          samplePoints: zone.samplePoints,
          updatedAt: new Date(),
        })
        .where(eq(geofenceZones.id, id));
    }),
  );
}
