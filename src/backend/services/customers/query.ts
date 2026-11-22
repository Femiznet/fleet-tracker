import { eq, desc, count, ilike, or } from 'drizzle-orm';
import { db } from '@/backend/db';
import { customers, type NewCustomer } from '@/backend/db/schema';

export const getCustomers = () => db.select().from(customers).orderBy(desc(customers.createdAt));

export const listCustomers = async (
  page: number,
  limit: number,
  search?: string,
  geofenceOnly = false
) => {
  const offset = (page - 1) * limit;
  const searchFilter = search
    ? geofenceOnly
      ? ilike(customers.geofenceName, `%${search}%`)
      : or(
          ilike(customers.name, `%${search}%`),
          ilike(customers.location, `%${search}%`),
          ilike(customers.geofenceName, `%${search}%`)
        )
    : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(searchFilter)
      .orderBy(desc(customers.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(customers).where(searchFilter),
  ]);

  return { rows, total: Number(totalRows[0]?.value ?? 0) };
};

export const getCustomerById = async (id: string) => {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id));
  return customer ?? null;
};

export const createCustomer = async (data: NewCustomer) => {
  const [customer] = await db.insert(customers).values(data).returning();
  return customer;
};

export const updateCustomer = async (id: string, data: Partial<NewCustomer>) => {
  const [customer] = await db.update(customers).set(data).where(eq(customers.id, id)).returning();
  return customer ?? null;
};

export const deleteCustomer = async (id: string) => {
  const [customer] = await db.delete(customers).where(eq(customers.id, id)).returning();
  return customer ?? null;
};
