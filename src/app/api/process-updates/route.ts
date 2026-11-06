
import { NextRequest, NextResponse } from "next/server";
import { processQueuedWhatsappUpdates } from "@/features/whatsapp/processor";

export async function POST(request: NextRequest) {
  const secret = process.env.AI_WORKER_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    const err_message = `Unauthorized`;
    console.log(`Error: ${err_message}`);    
    return NextResponse.json({ error: err_message }, { status: 401 });
  }

  try {
    const result = await processQueuedWhatsappUpdates();
    return NextResponse.json(result);
  } catch (error) {
    console.error("WhatsApp processing failed:", error);

    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 }
    );
  }
}
