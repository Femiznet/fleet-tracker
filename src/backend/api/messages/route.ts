import { processGreenApiMessage } from "@/backend/actions/messages";
import { returnValueDebugger } from "@/backend/lib/errors";
import { parseGreenApiMessage, type BaseWebhook } from "@/backend/services/messages/validator";
import { NextRequest } from "next/server";
import { apiSuccess } from "@/backend/lib/api-response";

export async function POST(request: NextRequest) {
    const body = (await request.json()) as BaseWebhook;
    const messageResult = parseGreenApiMessage(body);
 
    if (messageResult.error) {
        returnValueDebugger(messageResult);
        return apiSuccess({ ok: true });
    }
    
    if (messageResult.data) {
        const result = await processGreenApiMessage(messageResult.data);
        if (!result.success) returnValueDebugger(result);
    }

    return apiSuccess({ ok: true });
}