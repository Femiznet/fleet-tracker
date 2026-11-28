import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { customers } from '@fleet/database/schema';

export const customerIdSchema = z.string().uuid();

export const createCustomerSchema = createInsertSchema(customers, {
  name: (s) => s.trim().min(1, 'Name is required'),
  geofenceName: (s) =>
    s
      .trim()
      .optional()
      .transform((v) => v || null),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateCustomerSchema = createCustomerSchema
  .partial()
  .refine(
    (input) => Object.keys(input).length > 0,
    'Provide at least one field to update',
  );
