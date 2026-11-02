
import { after, NextResponse } from "next/server";
import {
  buildRegex,
  FIELDS,
  MIN_FIELDS,
  MIN_LENGTH,
  toPattern,
} from "@/lib/extract-update";
import { saveWhatsappUpdate } from "@/features/whatsapp/updates";
import { processQueuedWhatsappUpdates } from "@/features/whatsapp/processor";

export async function POST(request: Request) {
  try {
    const rawText = await request.text();
    const parts = rawText.split("|||");

    if (parts.length < 2) {
      return NextResponse.json(
        { error: "Invalid payload format. Expected 'title|||text'" },
        { status: 400 }
      );
    }

    const title = parts[1];
    const text = parts.slice(2).join("|||");

    const matched: string[] = [];

    FIELDS.forEach((f) => {
      let t = text;

      if (f.exclude) {
        t = t.replace(new RegExp(toPattern(f.exclude), "gi"), " ");
      }

      if (buildRegex(f).test(t)) matched.push(f.name);
    });

    const isUpdate =
      matched.length >= MIN_FIELDS && text.length >= MIN_LENGTH;

    if (!isUpdate) {
      return NextResponse.json({ error: "denied" }, { status: 400 });
    }

    const result = await saveWhatsappUpdate({
      group_name: null,
      sender: null,
      notification_title: title,
      message: text,
    });

    if (result.duplicate) {
      return NextResponse.json({ message: "Duplicate ignored" });
    }

    after(async () => {
      try {
        await processQueuedWhatsappUpdates();
      } catch (error) {
        console.error("Background AI processing failed:", error);
      }
    });

    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    console.error("WhatsApp update error:", error);

    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
