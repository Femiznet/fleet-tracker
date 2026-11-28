'use server';

import {
  invalidActionInput,
  type ActionResult,
  unavailableAction,
} from '@/actions/action-result';
import {
  cancelMovement,
  movementsFeatureAvailable,
  movementsFeatureUnavailableResponse,
  completeMovement,
  createDispatch,
  createPickup,
  manualDispatchAction,
  switchDispatchTrackingMode,
} from '@/generated/movements-feature';
import { getMovementActionError } from '@/lib/movement-api-errors';
import {
  cancelMovementRequestSchema,
  completeMovementRequestSchema,
  createDispatchRequestSchema,
  createPickupRequestSchema,
  manualDispatchActionRequestSchema,
  movementIdSchema,
  trackingModeRequestSchema,
} from '@/lib/validation/movements';
import { revalidatePath } from 'next/cache';

async function runMovement<T>(
  fallback: string,
  operation: () => Promise<T>,
  includeOverrideFlag = false,
): Promise<ActionResult<T>> {
  try {
    const data = await operation();
    revalidatePath('/movements');
    revalidatePath('/plant-status');
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: getMovementActionError(error, fallback, includeOverrideFlag),
    };
  }
}

export async function createDispatchAction(
  input: unknown,
): Promise<ActionResult<{ movementId: string }>> {
  if (!movementsFeatureAvailable) {
    return unavailableAction(movementsFeatureUnavailableResponse);
  }

  const parsed = createDispatchRequestSchema.safeParse(input);
  if (!parsed.success) {
    return invalidActionInput(parsed.error, 'Invalid dispatch request');
  }

  return runMovement('Failed to create dispatch', async () => ({
    movementId: await createDispatch(parsed.data),
  }));
}

export async function createPickupAction(
  input: unknown,
): Promise<ActionResult<{ movementId: string }>> {
  if (!movementsFeatureAvailable) {
    return unavailableAction(movementsFeatureUnavailableResponse);
  }

  const parsed = createPickupRequestSchema.safeParse(input);
  if (!parsed.success) {
    return invalidActionInput(parsed.error, 'Invalid pickup request');
  }

  return runMovement(
    'Failed to create pickup',
    async () => ({ movementId: await createPickup(parsed.data) }),
    true,
  );
}

export async function completeMovementAction(
  id: unknown,
  input: unknown,
): Promise<ActionResult<{ movementId: string; status: 'completed' }>> {
  if (!movementsFeatureAvailable) {
    return unavailableAction(movementsFeatureUnavailableResponse);
  }

  const parsedId = movementIdSchema.safeParse(id);
  if (!parsedId.success) {
    return invalidActionInput(parsedId.error, 'Invalid movement ID');
  }

  const parsed = completeMovementRequestSchema.safeParse(input);
  if (!parsed.success) {
    return invalidActionInput(parsed.error, 'Invalid completion request');
  }

  return runMovement('Failed to complete movement', async () => {
    await completeMovement({ movementId: parsedId.data, ...parsed.data });
    return { movementId: parsedId.data, status: 'completed' };
  });
}

export async function cancelMovementAction(
  id: unknown,
  input: unknown = {},
): Promise<ActionResult<{ movementId: string; status: 'cancelled' }>> {
  if (!movementsFeatureAvailable) {
    return unavailableAction(movementsFeatureUnavailableResponse);
  }

  const parsedId = movementIdSchema.safeParse(id);
  if (!parsedId.success) {
    return invalidActionInput(parsedId.error, 'Invalid movement ID');
  }

  const parsed = cancelMovementRequestSchema.safeParse(input);
  if (!parsed.success) {
    return invalidActionInput(parsed.error, 'Invalid cancellation request');
  }

  return runMovement('Failed to cancel movement', async () => {
    await cancelMovement({ movementId: parsedId.data, ...parsed.data });
    return { movementId: parsedId.data, status: 'cancelled' };
  });
}

export async function performManualDispatchAction(
  id: unknown,
  input: unknown,
): Promise<
  ActionResult<{ movementId: string; action: 'arrived_customer' | 'returning' }>
> {
  if (!movementsFeatureAvailable) {
    return unavailableAction(movementsFeatureUnavailableResponse);
  }

  const parsedId = movementIdSchema.safeParse(id);
  if (!parsedId.success) {
    return invalidActionInput(parsedId.error, 'Invalid movement ID');
  }

  const parsed = manualDispatchActionRequestSchema.safeParse(input);
  if (!parsed.success) {
    return invalidActionInput(parsed.error, 'Invalid manual dispatch action');
  }

  return runMovement('Failed to update manual dispatch', async () => {
    await manualDispatchAction({ movementId: parsedId.data, ...parsed.data });
    return { movementId: parsedId.data, action: parsed.data.action };
  });
}

export async function switchDispatchTrackingModeAction(
  id: unknown,
  input: unknown,
): Promise<
  ActionResult<{ movementId: string; trackingMode: 'live' | 'manual' }>
> {
  if (!movementsFeatureAvailable) {
    return unavailableAction(movementsFeatureUnavailableResponse);
  }

  const parsedId = movementIdSchema.safeParse(id);
  if (!parsedId.success) {
    return invalidActionInput(parsedId.error, 'Invalid movement ID');
  }

  const parsed = trackingModeRequestSchema.safeParse(input);
  if (!parsed.success) {
    return invalidActionInput(parsed.error, 'Invalid tracking mode');
  }

  return runMovement('Failed to switch dispatch tracking mode', async () => {
    await switchDispatchTrackingMode({
      movementId: parsedId.data,
      trackingMode: parsed.data.trackingMode,
    });
    return {
      movementId: parsedId.data,
      trackingMode: parsed.data.trackingMode,
    };
  });
}
