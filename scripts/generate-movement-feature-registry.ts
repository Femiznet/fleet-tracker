import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isFeatureAvailable } from './feature-registry';

const root = process.cwd();
const outputPath = resolve(root, 'src', 'generated', 'movements-feature.ts');

const sharedExports = `export const movementsFeatureUnavailableResponse = {
  error: 'MOVEMENTS_FEATURE_UNAVAILABLE',
  message: 'The movements feature is not installed',
};

`;

const movementTypes = `export type DispatchTrackingMode = 'live' | 'manual';

export interface CreateDispatchInput {
  truckId: string;
  customerId: string;
  skidIdOut: string;
  note?: string | null;
  trackingMode?: DispatchTrackingMode;
}

export type ManualDispatchAction = 'arrived_customer' | 'returning';

export interface CreatePickupInput {
  truckId: string;
  customerId: string;
  skidIdIn?: string | null;
  note?: string | null;
  forceOverride?: boolean;
}

export type skidInState = 'empty' | 'loaded';

export interface CompleteMovementInput {
  movementId: string;
  skidIdIn?: string | null;
  note?: string | null;
  skidInState: skidInState;
}

export interface CancelMovementInput {
  movementId: string;
  note?: string | null;
}

`;

const featureAvailable = isFeatureAvailable('movements');

const featureExports = featureAvailable
  ? `export {
  cancelMovement,
  completeMovement,
  createDispatch,
  createPickup,
  manualDispatchAction,
  switchDispatchTrackingMode,
} from '../../packages/features/movements/index';
export type {
  CancelMovementInput,
  CompleteMovementInput,
  CreateDispatchInput,
  CreatePickupInput,
  DispatchTrackingMode,
  ManualDispatchAction,
  skidInState,
} from '../../packages/features/movements/index';

export const movementsFeatureAvailable: boolean = true;
`
  : `export const movementsFeatureAvailable: boolean = false;

${movementTypes}function unavailable(): never {
  throw new Error(movementsFeatureUnavailableResponse.message);
}

export async function createDispatch(
  _input: CreateDispatchInput
): Promise<string> {
  return unavailable();
}

export async function manualDispatchAction(_input: {
  movementId: string;
  action: ManualDispatchAction;
}): Promise<void> {
  unavailable();
}

export async function switchDispatchTrackingMode(_input: {
  movementId: string;
  trackingMode: DispatchTrackingMode;
}): Promise<void> {
  unavailable();
}

export async function createPickup(
  _input: CreatePickupInput
): Promise<string> {
  return unavailable();
}

export async function completeMovement(
  _input: CompleteMovementInput
): Promise<void> {
  unavailable();
}

export async function cancelMovement(
  _input: CancelMovementInput
): Promise<void> {
  unavailable();
}
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${sharedExports}${featureExports}`);
