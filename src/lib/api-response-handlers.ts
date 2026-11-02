// lib/api.ts
import { NextResponse } from "next/server";
import { AppError, handleError } from "./errors";

// 1. SUCCESS RESPONSE -> { data } (+ optional meta)
export function ok<T>({
  data,
  status = 200,
  meta,
}: {
  data?: T;
  status?: number;
  meta?: Record<string, unknown>; // e.g. pagination, add more later
}) {
  return NextResponse.json({ data, ...(meta && { meta }) }, { status });
}

// 2. WRAPPER: no try/catch needed inside routes
export function withErrorHandler<C = unknown>(
  handler: (request: Request, context: C) => Promise<Response> | Response
) {
  return async (request: Request, context: C) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleError(error);
    }
  };
}

// 3. SUPABASE RESULT -> data, or throws the right error
export function unwrap<T>({
  result,
  notFound,
}: {
  result: { data: T | null; error: unknown };
  notFound?: string; // pass a message to turn "null" into a 404
}): T {
  if (result.error) throw result.error; // handleError maps the code to a status

  if (result.data === null || result.data === undefined) {
    if (notFound) throw new AppError({ message: notFound, status: 404 });
    return result.data as T;
  }

  return result.data;
}
