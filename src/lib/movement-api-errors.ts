import { NextResponse } from 'next/server';
import { getApiErrorInfo } from '@/lib/api-errors';
import type { ApiErrorInfo } from '@/lib/api-errors';

export type MovementActionError = ApiErrorInfo & {
  status: number;
  requiresOverride?: boolean;
};

export function getMovementActionError(
  error: unknown,
  fallback: string,
  includeOverrideFlag = false,
): MovementActionError {
  const info = getApiErrorInfo(error, fallback);
  const requiresOverride = info.error.includes('Use manual override');
  let status = 500;
  if (requiresOverride || info.code === '23505') {
    status = 409;
  } else if (['P0001', '22P02', '23503', '23514'].includes(info.code ?? '')) {
    status = 400;
  }

  return {
    ...info,
    status,
    ...(includeOverrideFlag || requiresOverride ? { requiresOverride } : {}),
  };
}

export function movementApiErrorResponse(
  error: unknown,
  fallback: string,
  includeOverrideFlag = false,
) {
  const { status, ...body } = getMovementActionError(
    error,
    fallback,
    includeOverrideFlag,
  );
  return NextResponse.json(body, { status });
}
