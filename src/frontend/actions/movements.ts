import { z } from 'zod';
import { parseResponse, requestJson } from '@/frontend/actions/http';
import {
  ActiveMovementSchema,
  DirectDispatchResponseSchema,
  MovementActionResponseSchema,
  MovementOptionsSchema,
  type ActiveMovement,
  type DirectDispatchResult,
  type MovementOptions,
} from '@/frontend/types/movement';

const MovementOptionsResponseSchema = z.object({ data: MovementOptionsSchema });
const ActiveMovementsResponseSchema = z.object({ data: z.array(ActiveMovementSchema) });

export async function getMovementOptions(): Promise<MovementOptions> {
  const response = parseResponse(
    await requestJson('/api/movements/options'),
    MovementOptionsResponseSchema,
    'Movement options returned an invalid response.'
  );
  return response.data;
}

export async function listActiveMovements(): Promise<ActiveMovement[]> {
  const response = parseResponse(
    await requestJson('/api/movements/active'),
    ActiveMovementsResponseSchema,
    'Active movements returned an invalid response.'
  );
  return response.data;
}

export async function createDirectDispatch(input: {
  truckId: string;
  customerId: string;
  skidIdOut: string;
  note?: string;
  forceOverride: boolean;
}): Promise<DirectDispatchResult> {
  const response = parseResponse(
    await requestJson('/api/movements/dispatch', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
    z.object({ data: DirectDispatchResponseSchema }),
    'Direct dispatch returned an invalid response.'
  );
  return response.data;
}

export async function createPickup(input: {
  truckId: string;
  customerId: string;
  skidIdIn?: string;
  note?: string;
  forceOverride: boolean;
}): Promise<{ movementId: string }> {
  const response = parseResponse(
    await requestJson('/api/movements/pickup', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
    z.object({ data: z.object({ movementId: z.string() }) }),
    'Pickup creation returned an invalid response.'
  );
  return response.data;
}

export async function completeMovement(
  movementId: string,
  input: { skidIdIn?: string; note?: string; forceOverride: boolean }
) {
  const response = parseResponse(
    await requestJson(`/api/movements/${encodeURIComponent(movementId)}/complete`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
    z.object({ data: MovementActionResponseSchema }),
    'Movement completion returned an invalid response.'
  );
  return response.data;
}

export async function cancelMovement(movementId: string, note?: string) {
  const response = parseResponse(
    await requestJson(`/api/movements/${encodeURIComponent(movementId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
    z.object({ data: MovementActionResponseSchema }),
    'Movement cancellation returned an invalid response.'
  );
  return response.data;
}

export async function markMovementNotified(movementId: string) {
  const response = parseResponse(
    await requestJson(`/api/movements/${encodeURIComponent(movementId)}/notified`, {
      method: 'POST',
    }),
    z.object({ data: MovementActionResponseSchema }),
    'Notification confirmation returned an invalid response.'
  );
  return response.data;
}
