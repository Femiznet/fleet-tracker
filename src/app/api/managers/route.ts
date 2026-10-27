// app/api/managers/route.ts
import { ok, withErrorHandler } from "@/lib/api-response-handlers";
import { registerManager } from "@/features/managers/services";

export const POST = withErrorHandler(async (request) => {
  const body = await request.json();
  const data = await registerManager(body);
  return ok({ data, status: 201 });
});