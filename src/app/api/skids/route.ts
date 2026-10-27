// app/api/skids/route.ts
import { ok, withErrorHandler } from "@/lib/api-response-handlers";
import { registerSkid } from "@/features/skids/services";

export const POST = withErrorHandler(async (request) => {
  const body = await request.json();
  const data = await registerSkid(body);
  return ok({ data, status: 201 });
});