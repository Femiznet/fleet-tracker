import { db } from '@/backend/db';
import { trucks } from '@/backend/db/schema';

export interface HclTrackerTruck {
  plateNumber: string;
  speed: string;
  address: string;
  status: string;
  group: string | null;
  lat: number;
  lon: number;
}

export interface HclTruckData {
  data: HclTrackerTruck[];
}

export async function insertTrucks(newTrucks: HclTrackerTruck[]) {
  if (!newTrucks.length) return;

  const rows = newTrucks.map((item) => ({
    truckNum: item.plateNumber.trim(),
    lat: item.lat,
    lon: item.lon,
    speed: parseInt(item.speed, 10) || 0,
    group: item.group,
  }));

  return await db.insert(trucks).values(rows).onConflictDoNothing().returning({
    id: trucks.id,
    truckNum: trucks.truckNum,
  });
}
