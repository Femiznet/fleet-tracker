import { NextResponse } from 'next/server';
import { getApiErrorInfo } from '@/lib/api-errors';

export function movementApiErrorResponse(
  error: unknown,
  fallback: string,
  includeOverrideFlag = false,
) {
  const info = getApiErrorInfo(error, fallback);
  const requiresOverride = info.error.includes('Use manual override');
  let status = 500;
  if (requiresOverride || info.code === '23505') {
    status = 409;
  } else if (['P0001', '22P02', '23503', '23514'].includes(info.code ?? '')) {
    status = 400;
  }

  return NextResponse.json(
    {
      ...info,
      ...(includeOverrideFlag || requiresOverride ? { requiresOverride } : {}),
    },
    { status },
  );
}
