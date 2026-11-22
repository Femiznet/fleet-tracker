import { count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '@/backend/db';
import { trucks, type NewTruck } from '@/backend/db/schema';

export async function listTrucks(page: number, limit: number, search?: string) {
  const offset = (page - 1) * limit;
  const searchFilter = search
    ? or(
        ilike(trucks.truckNum, `%${search}%`),
        ilike(trucks.slugNum, `%${search}%`),
        ilike(trucks.currentLoc, `%${search}%`)
      )
    : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(trucks)
      .where(searchFilter)
      .orderBy(desc(trucks.truckNum))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(trucks).where(searchFilter),
  ]);

  return { rows, total: Number(totalRows[0]?.value ?? 0) };
}

export async function getTruckById(id: string) {
  const [truck] = await db.select().from(trucks).where(eq(trucks.id, id));
  return truck ?? null;
}

export async function createTruck(data: NewTruck) {
  const [truck] = await db.insert(trucks).values(data).returning();
  return truck;
}

export async function updateTruck(id: string, data: Partial<NewTruck>) {
  const [truck] = await db.update(trucks).set(data).where(eq(trucks.id, id)).returning();
  return truck ?? null;
}

export async function deleteTruck(id: string) {
  const [truck] = await db.delete(trucks).where(eq(trucks.id, id)).returning();
  return truck ?? null;
}
