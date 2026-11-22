export interface ApiError {
  code: string;
  message: string;
  field?: string;
  details?: unknown;
}

export interface ApiSuccess<T> {
  data: T;
  meta?: {
    pagination?: PaginationMeta;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
