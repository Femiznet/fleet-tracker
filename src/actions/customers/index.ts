'use server';

import {
  actionError,
  invalidActionInput,
  type ActionResult,
  unavailableAction,
} from '@/actions/action-result';
import {
  createCustomer,
  createCustomerSchema,
  customerIdSchema,
  customersFeatureAvailable,
  customersFeatureUnavailableResponse,
  deleteCustomer,
  findCustomerById,
  listCustomers,
  updateCustomer,
  updateCustomerSchema,
} from '@/generated/customers-feature';
import type { Customer } from '@fleet/database/schema';
import { revalidatePath } from 'next/cache';

export async function listCustomersAction(): Promise<ActionResult<Customer[]>> {
  if (!customersFeatureAvailable) {
    return unavailableAction(customersFeatureUnavailableResponse);
  }

  try {
    return { success: true, data: await listCustomers() };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, 'Failed to fetch customers'),
    };
  }
}

export async function getCustomerAction(
  id: unknown,
): Promise<ActionResult<Customer | null>> {
  if (!customersFeatureAvailable) {
    return unavailableAction(customersFeatureUnavailableResponse);
  }

  const parsedId = customerIdSchema.safeParse(id);
  if (!parsedId.success) {
    return invalidActionInput(parsedId.error, 'Invalid customer ID');
  }

  try {
    return { success: true, data: await findCustomerById(parsedId.data) };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, 'Failed to fetch customer'),
    };
  }
}

export async function createCustomerAction(
  input: unknown,
): Promise<ActionResult<Customer | undefined>> {
  if (!customersFeatureAvailable) {
    return unavailableAction(customersFeatureUnavailableResponse);
  }

  const parsed = createCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return invalidActionInput(parsed.error, 'Invalid customer data');
  }

  try {
    const data = await createCustomer(parsed.data);
    revalidatePath('/customers');
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, 'Failed to create customer'),
    };
  }
}

export async function updateCustomerAction(
  id: unknown,
  input: unknown,
): Promise<ActionResult<Customer | null>> {
  if (!customersFeatureAvailable) {
    return unavailableAction(customersFeatureUnavailableResponse);
  }

  const parsedId = customerIdSchema.safeParse(id);
  if (!parsedId.success) {
    return invalidActionInput(parsedId.error, 'Invalid customer ID');
  }

  const parsed = updateCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return invalidActionInput(parsed.error, 'Invalid customer data');
  }

  try {
    const data = await updateCustomer(parsedId.data, parsed.data);
    revalidatePath('/customers');
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, 'Failed to update customer'),
    };
  }
}

export async function deleteCustomerAction(
  id: unknown,
): Promise<ActionResult<Customer | null>> {
  if (!customersFeatureAvailable) {
    return unavailableAction(customersFeatureUnavailableResponse);
  }

  const parsedId = customerIdSchema.safeParse(id);
  if (!parsedId.success) {
    return invalidActionInput(parsedId.error, 'Invalid customer ID');
  }

  try {
    const data = await deleteCustomer(parsedId.data);
    revalidatePath('/customers');
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, 'Failed to delete customer'),
    };
  }
}
