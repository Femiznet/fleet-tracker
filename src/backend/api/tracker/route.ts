import { asc, eq } from 'drizzle-orm';
import { db } from '@/backend/db';
import { customers } from '@/backend/db/schema/customers';
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
    const [truckRows, skidRows, zones] = await Promise.all([
      db
        .select({
          id: trucks.id,
          truckNum: trucks.truckNum,
          slugNum: trucks.slugNum,
          group: trucks.group,
          lat: trucks.lat,
          lon: trucks.lon,
          currentLoc: trucks.currentLoc,
          speed: trucks.speed,
          status: trucks.status,
          isStandby: plantTruckStatuses.isStandby,
          isOnMaintenance: plantTruckStatuses.isOnMaintenance,
          maintenanceNote: plantTruckStatuses.maintenanceNote,
          note: plantTruckStatuses.note,
        })
        .from(trucks)
        .leftJoin(plantTruckStatuses, eq(plantTruckStatuses.truckId, trucks.id))
        .orderBy(asc(trucks.truckNum)),
      db
        .select({
          id: skids.id,
          skidNum: skids.skidNum,
          slugNum: skids.slugNum,
          currentLoc: skids.currentLoc,
          status: skids.status,
          owner: skids.owner,
          isNew: skids.isNew,
          customerName: customers.name,
          fillState: plantSkidStatuses.fillState,
          bay: plantSkidStatuses.bay,
          isOnMaintenance: plantSkidStatuses.isOnMaintenance,
          maintenanceNote: plantSkidStatuses.maintenanceNote,
          note: plantSkidStatuses.note,
        })
        .from(skids)
        .leftJoin(customers, eq(skids.customerId, customers.id))
        .leftJoin(plantSkidStatuses, eq(plantSkidStatuses.skidId, skids.id))
        .orderBy(asc(skids.skidNum)),
      db.select().from(geofenceZones),
    ]);

    const namedZones = zones.filter(
      (zone): zone is typeof zone & { geofenceName: string } => zone.geofenceName !== null
    );

    return apiSuccess({
      trucks: truckRows.map(({ group, ...truck }) => ({
        ...truck,
        isStandby: truck.isStandby ?? false,
        isOnMaintenance: truck.isOnMaintenance ?? false,
        maintenanceNote: truck.maintenanceNote ?? null,
        note: truck.note ?? null,
        geofence:
          group?.trim().toUpperCase() === 'GASTECH VEHICLES' &&
          hasValidCoordinates(truck.lat, truck.lon)
            ? findMatchingGeofence(namedZones, truck.lat, truck.lon)
            : null,
      })),
      skids: skidRows.map((skid) => ({
        ...skid,
        fillState: skid.fillState ?? null,
        bay: skid.bay ?? null,
        isOnMaintenance: skid.isOnMaintenance ?? false,
        maintenanceNote: skid.maintenanceNote ?? null,
        note: skid.note ?? null,
      })),
    });
  } catch (error) {
    return apiDbError(error);
  }
}
