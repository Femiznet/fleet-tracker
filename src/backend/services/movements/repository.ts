import { count, desc, eq } from 'drizzle-orm';
import { db } from '@/backend/db';
import { movements } from '@/backend/db/schema';

export async function listMovements(page: number, limit: number) {
  const offset = (page - 1) * limit;
  const [rows, totalRows] = await Promise.all([
    db.select().from(movements).orderBy(desc(movements.id)).limit(limit).offset(offset),
    db.select({ value: count() }).from(movements),
  ]);

  return { rows, total: Number(totalRows[0]?.value ?? 0) };
}

export async function getMovementById(id: string) {
  const [movement] = await db.select().from(movements).where(eq(movements.id, id));
  return movement ?? null;
}
