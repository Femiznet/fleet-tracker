import { NextResponse } from 'next/server';
import { treeifyZodError } from './errors';
import type { ZodError } from 'zod';

export interface ApiErrorInfo {
  error: string;
  code?: string;
  field?: string;
  details?: unknown;
}

export function getApiErrorInfo(error: unknown, fallback: string): ApiErrorInfo {
  const record =
    error && typeof error === 'object'
      ? (error as Record<string, unknown>)
      : undefined;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : record?.message;

  if (typeof message !== 'string' || message.trim() === '') {
    if (record && ('errors' in record || 'properties' in record || 'issues' in record)) {
      return { error: fallback, details: error };
    }

    console.error(fallback, error);
    return { error: fallback };
  }

  const info: ApiErrorInfo = { error: message };
  if (typeof record?.code === 'string') info.code = record.code;
  if (typeof record?.field === 'string') info.field = record.field;
  if (Array.isArray(record?.issues)) info.details = record.issues;
  return info;
}

export function apiErrorResponse(
  error: unknown,
  fallback: string,
  status = 500,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    { ...getApiErrorInfo(error, fallback), ...extra },
    { status }
  );
}

export function apiValidationErrorResponse(error: ZodError, fallback: string) {
  return NextResponse.json(
    { error: fallback, details: treeifyZodError(error) },
    { status: 400 }
  );
}
