'use server';

import { treeifyZodError } from '@/lib/errors';
import {
  createCustomer,
  createCustomerSchema,
  customerIdSchema,
  customersFeatureAvailable,
  customersFeatureUnavailableResponse,
  deleteCustomer,
  updateCustomer,
  updateCustomerSchema,
} from '@/generated/customers-feature';
import { revalidatePath } from 'next/cache';

export async function createCustomerAction(input: unknown) {
  if (!customersFeatureAvailable) {
    return { success: false, error: customersFeatureUnavailableResponse };
  }

  const parsed = createCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: treeifyZodError(parsed.error) };
  }

  const data = await createCustomer(parsed.data);
  revalidatePath('/customers');
  return { success: true, data };
}

export async function updateCustomerAction(id: string, input: unknown) {
  if (!customersFeatureAvailable) {
    return { success: false, error: customersFeatureUnavailableResponse };
  }

  const parsedId = customerIdSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, error: treeifyZodError(parsedId.error) };
  }

  const parsed = updateCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: treeifyZodError(parsed.error) };
  }

  const data = await updateCustomer(parsedId.data, parsed.data);
  revalidatePath('/customers');
  return { success: true, data };
}

export async function deleteCustomerAction(id: string) {
  if (!customersFeatureAvailable) {
    return { success: false, error: customersFeatureUnavailableResponse };
  }

  const parsedId = customerIdSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, error: treeifyZodError(parsedId.error) };
  }

  const data = await deleteCustomer(parsedId.data);
  revalidatePath('/customers');
  return { success: true, data };
}
