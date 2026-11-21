import { createInsertSchema } from 'drizzle-zod';
import { customers } from '@/backend/db/schema';

export const createCustomerSchema = createInsertSchema(customers, {
  name: (s) => s.trim().min(1, 'Name is required'),
  geofenceName: (s) => s.trim().optional().transform((v) => v || null),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateCustomerSchema = createCustomerSchema.partial();
