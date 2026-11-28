import { treeifyZodError } from '@/lib/errors';
import type { ZodError } from 'zod';

export type ActionFailure = {
  error: string;
  status: number;
  code?: string;
  field?: string;
  details?: unknown;
  requiresOverride?: boolean;
};

export type ActionResult<T> =
  { success: true; data: T } | { success: false; error: ActionFailure };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function failedAction<T = never>(
  message: string,
  status: number,
  options: Omit<ActionFailure, 'error' | 'status'> = {},
): ActionResult<T> {
  return {
    success: false,
    error: { error: message, status, ...options },
  };
}

export function invalidActionInput(
  error: ZodError,
  message: string,
): ActionResult<never> {
  return failedAction(message, 400, {
    code: 'VALIDATION_ERROR',
    details: treeifyZodError(error),
  });
}

export function unavailableAction(response: {
  error: string;
  message: string;
}): ActionResult<never> {
  return failedAction(response.message, 503, { code: response.error });
}

export function actionError(
  error: unknown,
  fallback: string,
  defaultStatus = 500,
): ActionFailure {
  const record = isRecord(error) ? error : undefined;
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : typeof record?.message === 'string' && record.message.trim()
        ? record.message
        : fallback;

  return {
    error: message,
    status: typeof record?.status === 'number' ? record.status : defaultStatus,
    ...(typeof record?.code === 'string' ? { code: record.code } : {}),
    ...(typeof record?.field === 'string' ? { field: record.field } : {}),
  };
}
