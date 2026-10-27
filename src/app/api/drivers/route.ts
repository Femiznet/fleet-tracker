// app/api/drivers/route.ts
import { ok, withErrorHandler } from "@/lib/api-response-handlers";
import { registerDriver } from "@/features/drivers/services";

export const POST = withErrorHandler(async (request) => {
    const body = await request.json();
    const data = await registerDriver(body);
    return ok({ data, status: 201 });
});