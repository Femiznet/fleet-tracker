import { count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '@/db';
import { drivers, type NewDriver } from '@/db/schema';

export async function listDrivers(page: number, limit: number, search?: string) {
  const offset = (page - 1) * limit;
  const searchFilter = search
    ? or(ilike(drivers.name, `%${search}%`), ilike(drivers.phone, `%${search}%`))
    : undefined;

  const [rows, totalRows] = await Promise.all([
    db.select().from(drivers).where(searchFilter).orderBy(desc(drivers.name)).limit(limit).offset(offset),
    db.select({ value: count() }).from(drivers).where(searchFilter),
  ]);

  return { rows, total: Number(totalRows[0]?.value ?? 0) };
}

export async function getDriverById(id: string) {
  const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
  return driver ?? null;
}

export async function createDriver(data: NewDriver) {
  const [driver] = await db.insert(drivers).values(data).returning();
  return driver;
}

export async function updateDriver(id: string, data: Partial<NewDriver>) {
  const [driver] = await db.update(drivers).set(data).where(eq(drivers.id, id)).returning();
  return driver ?? null;
}

export async function deleteDriver(id: string) {
  const [driver] = await db.delete(drivers).where(eq(drivers.id, id)).returning();
  return driver ?? null;
}
