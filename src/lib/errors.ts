
interface DebugValueInputType {
    success?: boolean;
    data?: object;
    message?: string;
    error?: Error;
}

export function returnValueDebugger(input: unknown) {
    const value = input as DebugValueInputType;

    if (!value.success) {
        console.log("FAILURE MESSAGE:", value.message);
        console.error("ERROR:", value.error);
    } else {
        console.log("SUCCESSFUL MESSAGE:", value.message);
        console.log("DATA:", value.data);
    }
}


/**
 * Helper to extract clean error messages thrown by PostgreSQL RAISE EXCEPTION
 */
export function formatPostgresError(error: unknown): Error {
  if (error && typeof error === 'object') {
    const pgError = error as { message?: string; cause?: { message?: string } };
    const cleanMessage = pgError.cause?.message || pgError.message;
    if (cleanMessage) {
      return new Error(cleanMessage);
    }
  }
  return new Error('An unexpected database error occurred');
}