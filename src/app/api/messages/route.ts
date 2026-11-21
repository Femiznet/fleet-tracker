import { processGreenApiMessage } from "@/actions/messages";
import { returnValueDebugger } from "@/lib/errors";
import { parseGreenApiMessage, type BaseWebhook } from "@/services/messages/validator";
import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";

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