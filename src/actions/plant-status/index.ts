'use server';

import {
  actionError,
  invalidActionInput,
  type ActionResult,
  unavailableAction,
} from '@/actions/action-result';
import {
  getPlantStatusDashboard,
  plantStatusDateQuerySchema,
  plantStatusFeatureAvailable,
  plantStatusFeatureUnavailableResponse,
  updatePlantStatusReport,
  updatePlantStatusSchema,
} from '@/generated/plant-status-feature';
import { revalidatePath } from 'next/cache';

export async function getPlantStatusAction(
  date?: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof getPlantStatusDashboard>>>> {
  if (!plantStatusFeatureAvailable) {
    return unavailableAction(plantStatusFeatureUnavailableResponse);
  }

  const parsed = plantStatusDateQuerySchema.safeParse({ date });
  if (!parsed.success) {
    return invalidActionInput(parsed.error, 'Invalid plant status date');
  }

  try {
    return {
      success: true,
      data: await getPlantStatusDashboard(parsed.data.date),
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, 'Failed to load plant status data'),
    };
  }
}

export async function updatePlantStatusAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof updatePlantStatusReport>>>> {
  if (!plantStatusFeatureAvailable) {
    return unavailableAction(plantStatusFeatureUnavailableResponse);
  }

  const parsed = updatePlantStatusSchema.safeParse(input);
  if (!parsed.success) {
    return invalidActionInput(parsed.error, 'Invalid plant status update');
  }

  try {
    const data = await updatePlantStatusReport(parsed.data);
    revalidatePath('/plant-status');
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, 'Failed to update plant status'),
    };
  }
}
