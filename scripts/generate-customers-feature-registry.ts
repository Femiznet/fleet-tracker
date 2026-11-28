import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isFeatureAvailable } from './feature-registry';

const root = process.cwd();
const outputPath = resolve(root, 'src', 'generated', 'customers-feature.ts');

const sharedExports = `export const customersFeatureUnavailableResponse = {
  error: 'CUSTOMERS_FEATURE_UNAVAILABLE',
  message: 'The customers feature is not installed',
};

`;

const fallbackExports = `import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import {
  customers,
  type Customer,
  type NewCustomer,
} from '@fleet/database/schema';

export const customerIdSchema = z.string().uuid();

export const createCustomerSchema = createInsertSchema(customers, {
  name: (schema) => schema.trim().min(1, 'Name is required'),
  geofenceName: (schema) =>
    schema.trim().optional().transform((value) => value || null),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateCustomerSchema = createCustomerSchema
  .partial()
  .refine(
    (input) => Object.keys(input).length > 0,
    'Provide at least one field to update'
  );

function unavailable(): never {
  throw new Error(customersFeatureUnavailableResponse.message);
}

export async function listCustomers(): Promise<Customer[]> {
  return unavailable();
}

export async function findCustomerById(
  _id: string
): Promise<Customer | null> {
  return unavailable();
}

export async function findCustomerByGeofenceName(
  _geofenceName: string
): Promise<Customer | null> {
  return unavailable();
}

export async function createCustomer(
  _data: NewCustomer
): Promise<Customer | undefined> {
  return unavailable();
}

export async function updateCustomer(
  _id: string,
  _data: Partial<NewCustomer>
): Promise<Customer | null> {
  return unavailable();
}

export async function deleteCustomer(_id: string): Promise<Customer | null> {
  return unavailable();
}
`;

const featureAvailable = isFeatureAvailable('customers');
const featureExports = featureAvailable
  ? `export {
  createCustomer,
  createCustomerSchema,
  customerIdSchema,
  deleteCustomer,
  findCustomerByGeofenceName,
  findCustomerById,
  listCustomers,
  updateCustomer,
  updateCustomerSchema,
} from '../../packages/features/customers/src/index';

export const customersFeatureAvailable: boolean = true;
`
  : `export const customersFeatureAvailable: boolean = false;

${fallbackExports}`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${sharedExports}${featureExports}`);
