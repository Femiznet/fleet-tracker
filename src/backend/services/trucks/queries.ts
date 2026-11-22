import { inArray, sql } from 'drizzle-orm';
import { db } from '@/backend/db';
import { trucks } from '@/backend/db/schema';
import { deriveTruckSlugNumber } from './identifiers';

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
    slugNum: deriveTruckSlugNumber(item.plateNumber.trim()),
    lat: item.lat,
    lon: item.lon,
    speed: parseInt(item.speed, 10) || 0,
    group: item.group,
  }));
  const slugCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.slugNum) {
      const key = row.slugNum.toUpperCase();
      slugCounts.set(key, (slugCounts.get(key) ?? 0) + 1);
    }
  }
  const candidateSlugs = [...slugCounts.keys()];
  const existingSlugRows = candidateSlugs.length
    ? await db
        .select({ slugNum: trucks.slugNum, truckNum: trucks.truckNum })
        .from(trucks)
        .where(inArray(sql<string>`UPPER(TRIM(${trucks.slugNum}))`, candidateSlugs))
    : [];
  const existingSlugOwners = new Map(
    existingSlugRows.flatMap((truck) =>
      truck.slugNum
        ? [[truck.slugNum.trim().toUpperCase(), truck.truckNum.trim().toUpperCase()] as const]
        : []
    )
  );
  const safeRows = rows.map((row) => {
    const slugKey = row.slugNum?.toUpperCase();
    const existingOwner = slugKey ? existingSlugOwners.get(slugKey) : undefined;
    return {
      ...row,
      slugNum:
        slugKey &&
        slugCounts.get(slugKey) === 1 &&
        (!existingOwner || existingOwner === row.truckNum.toUpperCase())
          ? row.slugNum
          : null,
    };
  });

  return await db
    .insert(trucks)
    .values(safeRows)
    .onConflictDoUpdate({
      target: trucks.truckNum,
      set: { slugNum: sql`COALESCE(${trucks.slugNum}, EXCLUDED.slug_num)` },
    })
    .returning({
      id: trucks.id,
      truckNum: trucks.truckNum,
    });
}
