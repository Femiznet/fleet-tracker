import { parseGreenApiMessage, type GreenApiIncomingWebhook } from "@/services/messages/validator";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    const body = (await request.json()) as GreenApiIncomingWebhook;
    const { data, error } = parseGreenApiMessage(body);
 
    if (error) {
        console.log(body);
        console.error('Validation errors:', error.properties);
        return NextResponse.json({ ok: true });
    }
    
    console.log(data);

    return NextResponse.json({ ok: true });
}