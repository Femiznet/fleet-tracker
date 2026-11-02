// lib/actions.ts
import { normalizeError } from "./errors";

// What every server action returns
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

// Next's redirect() / notFound() work by throwing; they must pass through
function isNextControlFlow(error: unknown) {
  const digest = (error as { digest?: unknown })?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

// Wrapper for server actions: never throws, always returns ActionResult
export function withAction<A extends unknown[], T>(
  fn: (...args: A) => Promise<T>
) {
  return async (...args: A): Promise<ActionResult<T>> => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (error) {
      if (isNextControlFlow(error)) throw error;

      const { message, status } = normalizeError(error);
      return { ok: false, error: message, status };
    }
  };
}

// Shortcut for actions that don't need to return data
export function okResult(): ActionResult<null> {
  return { ok: true, data: null };
}