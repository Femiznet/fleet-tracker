'use server';

import {
  actionError,
  invalidActionInput,
  type ActionResult,
  unavailableAction,
} from '@/actions/action-result';
import {
  createCustomerSkidLoading,
  createCustomerSkidLoadingSchema,
  customerSkidLoadingIdSchema,
  customerSkidLoadingsFeatureAvailable,
  customerSkidLoadingsFeatureUnavailableResponse,
  dispatchCustomerSkidLoading,
  getCustomerSkidLoadings,
  updateCustomerSkidLoading,
  updateCustomerSkidLoadingSchema,
} from '@/generated/customer-skid-loadings-feature';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const includeHistorySchema = z
  .union([
    z.boolean(),
    z.enum(['true', 'false']).transform((value) => value === 'true'),
  ])
  .default(false);

function revalidateLoadingViews() {
  revalidatePath('/customer-skid-loadings');
  revalidatePath('/plant-status');
}

export async function listCustomerSkidLoadingsAction(
  includeHistory: unknown = false,
): Promise<ActionResult<Awaited<ReturnType<typeof getCustomerSkidLoadings>>>> {
  if (!customerSkidLoadingsFeatureAvailable) {
    return unavailableAction(customerSkidLoadingsFeatureUnavailableResponse);
  }

  const parsed = includeHistorySchema.safeParse(includeHistory);
  if (!parsed.success) {
    return invalidActionInput(parsed.error, 'Invalid loading history option');
  }

  try {
    return {
      success: true,
      data: await getCustomerSkidLoadings(parsed.data),
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, 'Failed to fetch customer skid loadings'),
    };
  }
}

export async function createCustomerSkidLoadingAction(
  input: unknown,
): Promise<
  ActionResult<Awaited<ReturnType<typeof createCustomerSkidLoading>>>
> {
  if (!customerSkidLoadingsFeatureAvailable) {
    return unavailableAction(customerSkidLoadingsFeatureUnavailableResponse);
  }

  const parsed = createCustomerSkidLoadingSchema.safeParse(input);
  if (!parsed.success) {
    return invalidActionInput(parsed.error, 'Invalid customer skid loading');
  }

  try {
    const data = await createCustomerSkidLoading(parsed.data);
    revalidateLoadingViews();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, 'Failed to register customer skid loading'),
    };
  }
}

export async function updateCustomerSkidLoadingAction(
  id: unknown,
  input: unknown,
): Promise<
  ActionResult<Awaited<ReturnType<typeof updateCustomerSkidLoading>>>
> {
  if (!customerSkidLoadingsFeatureAvailable) {
    return unavailableAction(customerSkidLoadingsFeatureUnavailableResponse);
  }

  const parsedId = customerSkidLoadingIdSchema.safeParse(id);
  if (!parsedId.success) {
    return invalidActionInput(
      parsedId.error,
      'Invalid customer skid loading ID',
    );
  }

  const parsed = updateCustomerSkidLoadingSchema.safeParse(input);
  if (!parsed.success) {
    return invalidActionInput(
      parsed.error,
      'Invalid customer skid loading update',
    );
  }

  try {
    const data = await updateCustomerSkidLoading(parsedId.data, parsed.data);
    revalidateLoadingViews();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, 'Failed to update customer skid loading'),
    };
  }
}

export async function dispatchCustomerSkidLoadingAction(
  id: unknown,
): Promise<
  ActionResult<Awaited<ReturnType<typeof dispatchCustomerSkidLoading>>>
> {
  if (!customerSkidLoadingsFeatureAvailable) {
    return unavailableAction(customerSkidLoadingsFeatureUnavailableResponse);
  }

  const parsedId = customerSkidLoadingIdSchema.safeParse(id);
  if (!parsedId.success) {
    return invalidActionInput(
      parsedId.error,
      'Invalid customer skid loading ID',
    );
  }

  try {
    const data = await dispatchCustomerSkidLoading(parsedId.data);
    revalidateLoadingViews();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, 'Failed to dispatch customer skid loading'),
    };
  }
}
