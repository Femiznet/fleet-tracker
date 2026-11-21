import type { PaginationMeta } from '@/types/api';

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function getPagination(request: Request): PaginationParams {
  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '25', 10) || 25));

  return { page, limit, offset: (page - 1) * limit };
}

export function getPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}
