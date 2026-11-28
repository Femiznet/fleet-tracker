import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isFeatureAvailable } from './feature-registry';

const root = process.cwd();
const outputPath = resolve(root, 'src', 'generated', 'plant-status-feature.ts');

const sharedExports = `export const plantStatusFeatureUnavailableResponse = {
  error: 'PLANT_STATUS_FEATURE_UNAVAILABLE',
  message: 'The plant status feature is not installed',
};

`;

const fallbackImports = `import { z } from 'zod';
import {
  plantStatusMetricsSchema,
  skidStateEnum,
} from '@fleet/database/schema';

`;

const fallbackExports = `export const plantStatusDateQuerySchema = z
  .object({
    date: z
      .string()
      .regex(/^\\d{4}-\\d{2}-\\d{2}$/, 'date must be a valid YYYY-MM-DD date')
      .refine((value) => {
        const parsed = new Date(\`\${value}T00:00:00.000Z\`);
        return (
          !Number.isNaN(parsed.getTime()) &&
          parsed.toISOString().slice(0, 10) === value
        );
      }, 'date must be a valid YYYY-MM-DD date')
      .optional(),
  })
  .strict();

const skidYardUpdateSchema = z
  .object({
    id: z.string().uuid(),
    state: z.enum(skidStateEnum.enumValues).optional(),
    isForWashing: z.boolean().optional(),
  })
  .strict()
  .refine(
    (update) =>
      update.state !== undefined || update.isForWashing !== undefined,
    'Provide state or isForWashing to update'
  );

export const updatePlantStatusSchema = z
  .object({
    officersOnDuty: z.string().trim().min(1).max(255),
    metrics: plantStatusMetricsSchema.default({}),
    skidUpdates: z.array(skidYardUpdateSchema).default([]),
    notes: z.string().nullable().optional(),
  })
  .strict();

export type SkidYardUpdate = z.infer<typeof skidYardUpdateSchema>;
export type UpdatePlantStatusInput = z.infer<typeof updatePlantStatusSchema>;

function unavailable(): never {
  throw new Error(plantStatusFeatureUnavailableResponse.message);
}

export async function getPlantStatusDashboard(
  _date?: string
): Promise<never> {
  return unavailable();
}

export async function updatePlantStatusReport(
  _input: UpdatePlantStatusInput
): Promise<never> {
  return unavailable();
}
`;

const featureAvailable = isFeatureAvailable('plant-status');

const featureExports = featureAvailable
  ? `export {
  getPlantStatusDashboard,
  plantStatusDateQuerySchema,
  updatePlantStatusReport,
  updatePlantStatusSchema,
} from '../../packages/features/plant-status/index';

export const plantStatusFeatureAvailable: boolean = true;
`
  : `export const plantStatusFeatureAvailable: boolean = false;

${fallbackExports}`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `${featureAvailable ? '' : fallbackImports}${sharedExports}${featureExports}`,
);
