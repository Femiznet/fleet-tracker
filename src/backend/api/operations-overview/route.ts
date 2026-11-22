import { count, sql } from 'drizzle-orm';
import { db } from '@/backend/db';
import { geofenceZones } from '@/backend/db/schema/geofence-zone';
import { plantSkidStatuses } from '@/backend/db/schema/plant-skid-status';
import { plantTruckStatuses } from '@/backend/db/schema/plant-truck-status';
import { skids } from '@/backend/db/schema/skids';
import { trucks } from '@/backend/db/schema/trucks';
import { apiDbError, apiSuccess } from '@/backend/lib/api-response';
import { findMatchingGeofence } from '@/backend/lib/geofence';

function hasValidCoordinates(lat: number, lon: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    (lat !== 0 || lon !== 0)
  );
}

export async function GET() {
  try {
    const [truckCounts, skidCounts, zones, trackedTrucks] = await Promise.all([
      db
        .select({
          total: count(),
          atPlant: count(
            sql`CASE WHEN UPPER(TRIM(${trucks.currentLoc})) = 'GASTECH PLANT' THEN 1 END`
          ),
          inTransit: count(sql`CASE WHEN ${trucks.status} = 'in_transit' THEN 1 END`),
          standby: count(
            sql`CASE WHEN ${trucks.status} = 'standby' OR ${plantTruckStatuses.isStandby} THEN 1 END`
          ),
          maintenance: count(
            sql`CASE WHEN ${trucks.status} = 'maintenance' OR ${plantTruckStatuses.isOnMaintenance} THEN 1 END`
          ),
        })
        .from(trucks)
        .leftJoin(plantTruckStatuses, sql`${plantTruckStatuses.truckId} = ${trucks.id}`),
      db
        .select({
          total: count(),
          atPlant: count(
            sql`CASE WHEN UPPER(TRIM(${skids.currentLoc})) = 'GASTECH PLANT' THEN 1 END`
          ),
          inTransit: count(sql`CASE WHEN ${skids.status} = 'in_transit' THEN 1 END`),
          atCustomer: count(sql`CASE WHEN ${skids.status} = 'at_customer' THEN 1 END`),
          maintenance: count(
            sql`CASE WHEN ${skids.status} = 'maintenance' OR ${plantSkidStatuses.isOnMaintenance} THEN 1 END`
          ),
        })
        .from(skids)
        .leftJoin(plantSkidStatuses, sql`${plantSkidStatuses.skidId} = ${skids.id}`),
      db.select().from(geofenceZones),
      db
        .select({ lat: trucks.lat, lon: trucks.lon })
        .from(trucks)
        .where(sql`UPPER(TRIM(${trucks.group})) = 'GASTECH VEHICLES'`),
    ]);

    const namedZones = zones.filter(
      (zone): zone is typeof zone & { geofenceName: string } => zone.geofenceName !== null
    );
    const geofenceCounts = new Map(namedZones.map((zone) => [zone.geofenceName, 0]));
    let trucksOutsideGeofences = 0;
    let trucksWithoutGps = 0;

    for (const truck of trackedTrucks) {
      if (!hasValidCoordinates(truck.lat, truck.lon)) {
        trucksWithoutGps += 1;
        continue;
      }

      const geofenceName = findMatchingGeofence(namedZones, truck.lat, truck.lon);
      if (geofenceName && geofenceCounts.has(geofenceName)) {
        geofenceCounts.set(geofenceName, (geofenceCounts.get(geofenceName) ?? 0) + 1);
      } else {
        trucksOutsideGeofences += 1;
      }
    }

    return apiSuccess({
      trucks: truckCounts[0],
      skids: skidCounts[0],
      geofences: namedZones
        .map((zone) => ({
          name: zone.geofenceName,
          trucks: geofenceCounts.get(zone.geofenceName) ?? 0,
          configured:
            zone.centerLat !== null &&
            zone.centerLon !== null &&
            zone.radiusMeters !== null &&
            zone.radiusMeters > 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      trucksOutsideGeofences,
      trucksWithoutGps,
    });
  } catch (error) {
    return apiDbError(error);
  }
}
