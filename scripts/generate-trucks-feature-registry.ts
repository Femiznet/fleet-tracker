import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isFeatureAvailable } from './feature-registry';

const root = process.cwd();
const outputPath = resolve(root, 'src', 'generated', 'trucks-feature.ts');

const sharedExports = `export const trucksFeatureUnavailableResponse = {
  error: 'TRUCKS_FEATURE_UNAVAILABLE',
  message: 'The trucks feature is not installed',
};

`;

const truckTypes = `export interface SeedTruckInput {
  truckNum: string;
  lat: number;
  lon: number;
  speed: number;
}

export interface TruckLocationInput {
  truckNum: string;
  newLat: number;
  newLon: number;
  speed: number;
}

export type ResolveTruckAddress = (
  lat: number,
  lon: number
) => Promise<string | null>;

`;

const featureAvailable = isFeatureAvailable('trucks');

const featureExports = featureAvailable
  ? `export {
  insertTrucks,
  processBatchTruckLocations,
} from '../../packages/features/trucks/index';
export type {
  ResolveTruckAddress,
  SeedTruckInput,
  TruckLocationInput,
} from '../../packages/features/trucks/index';

export const trucksFeatureAvailable: boolean = true;
`
  : `export const trucksFeatureAvailable: boolean = false;

${truckTypes}function unavailable(): never {
  throw new Error(trucksFeatureUnavailableResponse.message);
}

export async function insertTrucks(
  _trucks: SeedTruckInput[]
): Promise<never> {
  return unavailable();
}

export async function processBatchTruckLocations(
  _inputs: TruckLocationInput[],
  _resolveAddress: ResolveTruckAddress
): Promise<never> {
  return unavailable();
}
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${sharedExports}${featureExports}`);
