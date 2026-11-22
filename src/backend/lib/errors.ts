import z, { ZodError } from 'zod';

interface ValueInputType {
  success?: boolean;
  data?: object;
  message?: string;
  error?: Error;
  reason?: string;
}

export interface DbErrorInfo {
  message: string;
  field?: string;
  code?: string;
}

export function treeifyZodError(error: ZodError) {
  const errorTree = z.treeifyError(error);

  let properties;
  if ('properties' in errorTree) {
    properties = errorTree.properties;
  }

  const fullErrorTree = {
    errors: errorTree.errors,
    properties,
  };

  return fullErrorTree;
}

export function returnValueDebugger(input: unknown) {
  const value = input as ValueInputType;

  if (!value.success) {
    console.log('FAILURE MESSAGE:', value.message);
    console.log('FAILURE REASON:', value.reason);
    console.error('ERROR:', value.error);
  } else {
    console.log('SUCCESSFUL MESSAGE:', value.message);
    console.log('DATA:', value.data);
  }
}

/**
 * Formats a PostgreSQL/drizzle database error into a clean, client-friendly
 * error info object. Detects common constraint violations (unique, not-null,
 * check) and extracts the offending field name where possible.
 */
export function formatDbError(error: unknown): DbErrorInfo {
  const pgError = extractPgError(error);
  if (!pgError) {
    return { message: 'An unexpected database error occurred' };
  }

  const code = pgError.code as string | undefined;
  const detail = pgError.detail as string | undefined;
  const message = pgError.message as string | undefined;

  // 23505 = unique_violation
  if (code === '23505') {
    const fieldMatch = (detail || message || '').match(/Key \(([^)]+)\)/);
    const field = fieldMatch ? fieldMatch[1] : 'field';
    return {
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
      field,
      code,
    };
  }

  // 23502 = not_null_violation
  if (code === '23502') {
    return { message: 'A required field is missing', code };
  }

  // 23503 = check_violation (e.g. invalid enum value)
  if (code === '23503') {
    return { message: message || 'Database constraint violation', code };
  }

  return { message: message || 'An unexpected database error occurred' };
}

/**
 * Extracts the underlying PostgreSQL error object, which may be nested
 * under `error.cause` (drizzle/pg wrapping) or at the top level.
 */
function extractPgError(error: unknown): Record<string, unknown> | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const err = error as Record<string, unknown>;

  // drizzle/pg often nests the raw pg error under .cause
  if (err.cause && typeof err.cause === 'object' && (err.cause as Record<string, unknown>).code) {
    return err.cause as Record<string, unknown>;
  }

  // top-level pg error code
  if (err.code) {
    return err;
  }

  return null;
}
