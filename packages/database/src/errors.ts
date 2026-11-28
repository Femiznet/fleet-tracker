export interface DbErrorInfo {
  message: string;
  field?: string;
  code?: string;
}

/**
 * Formats a PostgreSQL/drizzle database error into a clean, client-friendly
 * error info object. Detects common constraint violations (unique, not-null,
 * check) and extracts the offending field name where possible.
 */
export function formatDbError(error: unknown): DbErrorInfo {
  console.error('[Database Error]:', error);

  const pgError = extractPgError(error);
  if (!pgError) {
    return { message: 'An unexpected database error occurred' };
  }

  const code = pgError.code as string | undefined;
  const detail = pgError.detail as string | undefined;
  const message = pgError.message as string | undefined;

  if (code === '23505') {
    const fieldMatch = (detail || message || '').match(/Key \(([^)]+)\)/);
    const field = fieldMatch ? fieldMatch[1] : 'field';
    return {
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
      field,
      code,
    };
  }

  if (code === '23502') {
    return { message: 'A required field is missing', code };
  }

  if (code === '23503') {
    const fieldMatch = (detail || '').match(/Key \(([^)]+)\)/);
    const field = fieldMatch ? fieldMatch[1] : 'referenced record';
    return {
      message: `Invalid ${field}: matching record does not exist`,
      ...(fieldMatch ? { field } : {}),
      code,
    };
  }

  if (code === '23514') {
    return { message: 'One or more values failed validation rules', code };
  }

  if (code === '22P02') {
    return { message: 'Invalid ID or data format provided', code };
  }

  if (code === 'P0001') {
    return {
      message: message || 'Operation could not be completed',
      code,
    };
  }

  return {
    message: 'An unexpected database error occurred',
    ...(code ? { code } : {}),
  };
}

function extractPgError(error: unknown): Record<string, unknown> | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const err = error as Record<string, unknown>;

  if (
    err.cause &&
    typeof err.cause === 'object' &&
    (err.cause as Record<string, unknown>).code
  ) {
    return err.cause as Record<string, unknown>;
  }

  if (err.code) {
    return err;
  }

  return null;
}
