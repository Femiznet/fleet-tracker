import { db } from '@fleet/database';
import { trucks } from '@fleet/database/schema';

export interface SeedTruckInput {
  truckNum: string;
  lat: number;
  lon: number;
  speed: number;
}

export async function insertTrucks(newTrucks: SeedTruckInput[]) {
  if (newTrucks.length === 0) return [];

  const rows = newTrucks.map((truck) => ({
    truckNum: truck.truckNum.trim(),
    lat: truck.lat,
    lon: truck.lon,
    speed: truck.speed,
  }));

  return db.insert(trucks).values(rows).onConflictDoNothing().returning({
    id: trucks.id,
    truckNum: trucks.truckNum,
  });
}
