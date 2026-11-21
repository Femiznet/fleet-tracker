import { z } from 'zod';

const ApiErrorSchema = z.object({
  error: z.object({ message: z.string() }),
});

export async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      ...(init?.headers ?? {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const payload: unknown = await response.json();

  if (!response.ok) {
    const parsedError = ApiErrorSchema.safeParse(payload);
    throw new Error(
      parsedError.success
        ? parsedError.data.error.message
        : `Request failed with status ${response.status}`
    );
  }

  return payload;
}

export function parseResponse<T>(payload: unknown, schema: z.ZodType<T>, message: string): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new Error(message);
  return parsed.data;
}
