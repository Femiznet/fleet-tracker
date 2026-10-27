// lib/errors.ts
import { NextResponse } from "next/server";

type AppErrorOptions = {
  message: string;
  status?: number; // defaults to 500
  // add new fields here later (e.g. code?: string)
};

// 1. The error you THROW when you know what went wrong
export class AppError extends Error {
  status: number;

  constructor({ message, status = 500 }: AppErrorOptions) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

// 2. Known Postgres / PostgREST codes -> proper status
const DB_ERRORS: Record<string, { status: number; message?: string }> = {
  "23503": { status: 409, message: "Related record not found or still in use" }, // foreign key
  "23514": { status: 400, message: "Invalid data" }, // check constraint
  "22P02": { status: 400, message: "Invalid input format" }, // e.g. bad uuid
  "42501": { status: 403, message: "Not allowed" }, // RLS / permissions
  PGRST116: { status: 404, message: "Not found" }, // .single() found 0 rows
  P0001: { status: 400 }, // your trigger's `raise exception` (keeps its message)
};

// Custom messages for specific constraints/indexes (by name)
const CONSTRAINT_MESSAGES: Record<string, string> = {
  one_active_dispatch_per_truck: "This truck already has an active dispatch",
  one_active_dispatch_per_driver: "This driver already has an active dispatch",
  one_active_dispatch_per_motormate: "This motormate already has an active dispatch",
  one_active_dispatch_per_skid: "This skid already has an active dispatch",
};

// Builds a message for a unique violation (23505) from the error itself
function uniqueViolationMessage(error: { message: string; details?: string }) {
  const constraint = error.message.match(/constraint "(.+?)"/)?.[1];
  if (constraint && CONSTRAINT_MESSAGES[constraint]) {
    return CONSTRAINT_MESSAGES[constraint];
  }

  // details looks like: Key (phone_number)=(123) already exists.
  const column = error.details?.match(/Key \((.+?)\)=/)?.[1];
  if (column) {
    return `A record with this ${column.replace(/_/g, " ")} already exists`;
  }

  return "That record already exists";
}

function isDbError(
  e: unknown
): e is { code: string; message: string; details?: string } {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    "message" in e &&
    typeof (e as { code: unknown }).code === "string"
  );
}

// 3. Turns ANY error into { message, status } (shared by routes and actions)
export function normalizeError(error: unknown): { message: string; status: number } {
  // Errors you threw on purpose
  if (error instanceof AppError) {
    return { message: error.message, status: error.status };
  }

  // Supabase / Postgres errors (you can `throw error` straight from supabase)
  if (isDbError(error)) {
    if (error.code === "23505") {
      return { message: uniqueViolationMessage(error), status: 409 };
    }

    const known = DB_ERRORS[error.code];
    if (known) {
      return { message: known.message ?? error.message, status: known.status };
    }
  }

  // Bad JSON body
  if (error instanceof SyntaxError) {
    return { message: "Invalid JSON body", status: 400 };
  }

  // Truly unknown: log it, don't leak details
  console.error(error);
  return { message: "Internal server error", status: 500 };
}

// 4. For API ROUTES: error -> NextResponse
export function handleError(error: unknown) {
  const { message, status } = normalizeError(error);
  return NextResponse.json({ error: message }, { status });
}