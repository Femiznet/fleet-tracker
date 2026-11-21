import { count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '@/backend/db';
import { skids, type NewSkid } from '@/backend/db/schema';

export async function listSkids(page: number, limit: number, search?: string) {
  const offset = (page - 1) * limit;
  const searchFilter = search
    ? or(
        ilike(skids.skidNum, `%${search}%`),
        ilike(skids.slugNum, `%${search}%`),
        ilike(skids.currentLoc, `%${search}%`)
      )
    : undefined;

  const [rows, totalRows] = await Promise.all([
    db.select().from(skids).where(searchFilter).orderBy(desc(skids.skidNum)).limit(limit).offset(offset),
    db.select({ value: count() }).from(skids).where(searchFilter),
  ]);

  return { rows, total: Number(totalRows[0]?.value ?? 0) };
}

export async function getSkidById(id: string) {
  const [skid] = await db.select().from(skids).where(eq(skids.id, id));
  return skid ?? null;
}

export async function createSkid(data: NewSkid) {
  const [skid] = await db.insert(skids).values(data).returning();
  return skid;
}

export async function updateSkid(id: string, data: Partial<NewSkid>) {
  const [skid] = await db.update(skids).set(data).where(eq(skids.id, id)).returning();
  return skid ?? null;
}

export async function deleteSkid(id: string) {
  const [skid] = await db.delete(skids).where(eq(skids.id, id)).returning();
  return skid ?? null;
}
