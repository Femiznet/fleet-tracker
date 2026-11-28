import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isFeatureAvailable } from './feature-registry';

const root = process.cwd();
const outputPath = resolve(
  root,
  'src',
  'generated',
  'customer-skid-loadings-feature.ts',
);

const sharedExports = `export const customerSkidLoadingsFeatureUnavailableResponse = {
  error: 'CUSTOMER_SKID_LOADINGS_FEATURE_UNAVAILABLE',
  message: 'The customer skid loadings feature is not installed',
};

`;

const fallbackExports = `import { z } from 'zod';
import { customerSkidLoadingStateEnum } from '@fleet/database/schema';

export const customerSkidLoadingIdSchema = z.string().uuid();

export const customerSkidLoadingStateSchema = z.enum(
  customerSkidLoadingStateEnum.enumValues
);

export const createCustomerSkidLoadingSchema = z
  .object({
    customerId: z.string().uuid(),
    skidNum: z.string().trim().min(1).max(100),
  })
  .strict();

export const updateCustomerSkidLoadingSchema = z
  .object({
    state: customerSkidLoadingStateSchema.optional(),
    isForWashing: z.boolean().optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.state !== undefined || input.isForWashing !== undefined,
    'Provide state or isForWashing to update'
  );

export const customerSkidLoadingListQuerySchema = z
  .object({
    includeHistory: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
  })
  .strict();

export type CustomerSkidLoadingState = z.infer<
  typeof customerSkidLoadingStateSchema
>;
export type CreateCustomerSkidLoadingInput = z.infer<
  typeof createCustomerSkidLoadingSchema
>;
export type UpdateCustomerSkidLoadingInput = z.infer<
  typeof updateCustomerSkidLoadingSchema
>;

export class CustomerSkidLoadingError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'CustomerSkidLoadingError';
  }
}

function unavailable(): never {
  throw new Error(customerSkidLoadingsFeatureUnavailableResponse.message);
}

export async function getCustomerSkidLoadings(
  _includeHistory = false
): Promise<never> {
  return unavailable();
}

export async function createCustomerSkidLoading(
  _input: CreateCustomerSkidLoadingInput
): Promise<never> {
  return unavailable();
}

export async function updateCustomerSkidLoading(
  _id: string,
  _input: UpdateCustomerSkidLoadingInput
): Promise<never> {
  return unavailable();
}

export async function dispatchCustomerSkidLoading(
  _id: string
): Promise<never> {
  return unavailable();
}
`;

const featureAvailable = isFeatureAvailable('customer-skid-loadings');

const featureExports = featureAvailable
  ? `export {
  createCustomerSkidLoading,
  CustomerSkidLoadingError,
  dispatchCustomerSkidLoading,
  getCustomerSkidLoadings,
  updateCustomerSkidLoading,
} from '../../packages/features/customer-skid-loadings/index';
export {
  createCustomerSkidLoadingSchema,
  customerSkidLoadingIdSchema,
  customerSkidLoadingListQuerySchema,
  customerSkidLoadingStateSchema,
  updateCustomerSkidLoadingSchema,
} from '../../packages/features/customer-skid-loadings/index';
export type {
  CreateCustomerSkidLoadingInput,
  CustomerSkidLoadingState,
  UpdateCustomerSkidLoadingInput,
} from '../../packages/features/customer-skid-loadings/index';

export const customerSkidLoadingsFeatureAvailable: boolean = true;
`
  : `export const customerSkidLoadingsFeatureAvailable: boolean = false;

${fallbackExports}`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${sharedExports}${featureExports}`);
