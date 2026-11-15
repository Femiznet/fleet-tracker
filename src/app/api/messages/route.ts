import { processAndSaveGreenApiMessage } from "@/actions/messages";
import { returnValueDebugger } from "@/lib/errors";
import { parseGreenApiMessage, type BaseWebhook } from "@/services/messages/validator";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    const body = (await request.json()) as BaseWebhook;
    const messageResult = parseGreenApiMessage(body);
 
    if (messageResult.error) {
        returnValueDebugger(messageResult);
        return NextResponse.json({ ok: true });
    }
    
    if (messageResult.data) {
        const result = await processAndSaveGreenApiMessage(messageResult.data);
        if (!result.success) returnValueDebugger(result);
    }

    return NextResponse.json({ ok: true });
}