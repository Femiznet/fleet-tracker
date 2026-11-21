import { count, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { trips, type NewTrip } from '@/db/schema';

export async function listTrips(page: number, limit: number) {
  const offset = (page - 1) * limit;
  const [rows, totalRows] = await Promise.all([
    db.select().from(trips).orderBy(desc(trips.id)).limit(limit).offset(offset),
    db.select({ value: count() }).from(trips),
  ]);

  return { rows, total: Number(totalRows[0]?.value ?? 0) };
}

export async function getTripById(id: string) {
  const [trip] = await db.select().from(trips).where(eq(trips.id, id));
  return trip ?? null;
}

export async function createTrip(data: NewTrip) {
  const [trip] = await db.insert(trips).values(data).returning();
  return trip;
}

export async function updateTrip(id: string, data: Partial<NewTrip>) {
  const [trip] = await db.update(trips).set(data).where(eq(trips.id, id)).returning();
  return trip ?? null;
}

export async function deleteTrip(id: string) {
  const [trip] = await db.delete(trips).where(eq(trips.id, id)).returning();
  return trip ?? null;
}
