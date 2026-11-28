import z, { ZodError } from 'zod';

export { formatDbError } from '@fleet/database/errors';
export type { DbErrorInfo } from '@fleet/database/errors';

export function treeifyZodError(error: ZodError) {
  return z.treeifyError(error);
}
