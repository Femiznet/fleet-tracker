'use server';

import { treeifyZodError, formatDbError } from '@/lib/errors';
import { createCustomer, deleteCustomer, updateCustomer } from '@/services/customers/query';
import { createCustomerSchema, updateCustomerSchema } from '@/services/customers/validator';
import { revalidatePath } from 'next/cache';


export async function createCustomerAction(input: unknown) {
  const parsed = createCustomerSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: treeifyZodError(parsed.error) };

  try {
    const data = await createCustomer(parsed.data);
    revalidatePath('/customers');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: formatDbError(error) };
  }
}

export async function updateCustomerAction(id: string, input: unknown) {
  const parsed = updateCustomerSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: treeifyZodError(parsed.error) };

  try {
    const data = await updateCustomer(id, parsed.data);
    revalidatePath('/customers');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: formatDbError(error) };
  }
}

export async function deleteCustomerAction(id: string) {
  try {
    const data = await deleteCustomer(id);
    revalidatePath('/customers');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: formatDbError(error) };
  }
}
