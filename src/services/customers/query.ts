import { eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import { customers, type NewCustomer } from '@/db/schema';

export const getCustomers = () =>
  db.select().from(customers).orderBy(desc(customers.createdAt));

export const getCustomerById = async (id: string) => {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id));
  return customer ?? null;
};

export const createCustomer = async (data: NewCustomer) => {
  const [customer] = await db.insert(customers).values(data).returning();
  return customer;
};

export const updateCustomer = async (id: string, data: Partial<NewCustomer>) => {
  const [customer] = await db
    .update(customers)
    .set(data)
    .where(eq(customers.id, id))
    .returning();
  return customer ?? null;
};

export const deleteCustomer = async (id: string) => {
  const [customer] = await db
    .delete(customers)
    .where(eq(customers.id, id))
    .returning();
  return customer ?? null;
};
