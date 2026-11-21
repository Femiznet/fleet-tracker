import { NextResponse } from 'next/server';
import type { ApiError, ApiSuccess, PaginationMeta } from '@/backend/types/api';

export function apiSuccess<T>(
  data: T,
  init?: { status?: number; pagination?: PaginationMeta }
) {
  const body: ApiSuccess<T> = { data };

  if (init?.pagination) {
    body.meta = { pagination: init.pagination };
  }

  return NextResponse.json(body, { status: init?.status ?? 200 });
}

export function apiError(
  error: ApiError,
  status = 500
) {
  return NextResponse.json({ error }, { status });
}

export function apiDbError(error: unknown) {
  console.error(error);
  return apiError({
    code: 'INTERNAL_ERROR',
    message: 'An unexpected database error occurred',
  });
}
