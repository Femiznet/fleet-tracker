
import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { decryptApiKey } from "@/lib/ai/encryption";
import { validateExtraction } from "@/lib/ai/extraction-schema";

function extractText(provider: string, result: unknown): string {
  if (provider === "google gemini") {
    return (result as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  if (provider === "anthropic") {
    return (result as { content?: { type?: string; text?: string }[] })?.content?.find((item) => item.type === "text")?.text ?? "";
  }

  return (result as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content ?? "";
}

async function callAiProvider(
  provider: string,
  model: string,
  apiKey: string,
  message: string
) {

  const prompt = `
THE PROVIDED MESSAGE IS A COMPRESSED NATURAL GAS WHATSAPP UPDATE
Extract operational information from this CNG LOGISTICS WhatsApp message.

Return exactly one JSON object with this structure:

{
  "data": {
    "customer_name": null,
    "prms_count": 1,
    "prms_flows": [
      {
        "prms": "PRMS 1",
        "flow_rate": null
      }
    ],
    "flow_rate": null,
    "total_flow": null,
    "meter_reading_scm":null,
    "current_pressure_bar": null, // could be named skid pressure or just pressure, do not mistake it for the out or outlet pressure
    "empty_skids": null,
    "standby_skids": null,
    "skid_in_use_count": null,
    "skid_in_use_numbers": null,
    "available_trucks": null,
    "available_landing_gear_boxes": null
  },
  "needs_review": false,
  "review_reason": null
}

Rules:
- Default to one PRMS unless the message indicates otherwise.
- Each PRMS has one flow meter.
- Extract each PRMS flow separately.
- Identify multiple PRMS from explicit PRMS references or clearly identified separate flow readings.
- Do not assume multiple flow readings represent multiple PRMS without evidence.
- total_flow must be the sum of all valid PRMS flow readings.
- meter_reading_scm is the cumulative "Total Flow" / "Total" meter reading in scm (a large number such as 1336527.2). It is not a flow rate. Never put it in flow_rate or total_flow.
- flow_rate must contain the same cumulative value as total_flow.
- If any expected flow reading is ambiguous or missing, set total_flow and flow_rate to null and flag for review.
- Never interpret ambiguous values such as "0 100" by guessing.
- Use null for missing or unclear values.
- One message produces one object.
- Set needs_review to true for ambiguity, conflicting values, or multiple customers.
- A flow rate of 0 is valid when explicitly reported as zero.
- Do not treat 0 as missing.
- Values like "0 100" remain ambiguous; never guess whether they mean 0 or 100.
- skid IDs must be arrays of strings. For 2 (2560, 2507), return count 2 and IDs ["2560", "2507"].
- Return JSON only.

WhatsApp message:
${message}
`;
  
  const normalized = provider.toLowerCase();

  let url: string;
  let headers: Record<string, string>;
  let body: object;

  if (normalized === "google gemini") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    headers = { "Content-Type": "application/json" };
    body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    };
  } else if (normalized === "anthropic") {
    url = "https://api.anthropic.com/v1/messages";
    headers = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
    body = {
      model,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    };
  } else {
    const endpoints: Record<string, string> = {
      openai: "https://api.openai.com/v1/chat/completions",
      groq: "https://api.groq.com/openai/v1/chat/completions",
      openrouter: "https://openrouter.ai/api/v1/chat/completions",
    };

    const endpoint = endpoints[normalized];

    if (!endpoint) {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }

    url = endpoint;
    headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    body = {
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`AI provider request failed (HTTP ${response.status})`);
  }

  const result = await response.json();
  const text = extractText(normalized, result);

  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  return JSON.parse(cleaned);
}

async function processMessage(
  update: { id: string; message: string },
  config: { provider: string; model: string; encrypted_api_key: string }
) {
  try {
    const result = await callAiProvider(
      config.provider,
      config.model,
      decryptApiKey(config.encrypted_api_key),
      update.message
    );

    if (
      !result ||
      typeof result !== "object" ||
      !result.data ||
      typeof result.data !== "object"
    ) {
      throw new Error("AI returned an invalid JSON structure.");
    }

    const { data, needsReview, reviewReason } = validateExtraction(result);

    const { error } = await supabaseAdmin
      .from("whatsapp_updates")
      .update({
        extracted_data: data,
        needs_review: needsReview,
        review_reason:reviewReason,
        processing_status: needsReview ? "needs_review" : "completed",
        processed_at: new Date().toISOString(),
        processing_error: null,
      })
      .eq("id", update.id);

    if (error) throw error;
  } catch (error) {
    await supabaseAdmin
      .from("whatsapp_updates")
      .update({
        processing_status: "failed",
        processing_error:
          error instanceof Error ? error.message : "Unknown processing error",
      })
      .eq("id", update.id);
  }
}

export async function processQueuedWhatsappUpdates() {
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  await supabaseAdmin.from("whatsapp_updates")
    .update({ processing_status: "failed", processing_error: "Stuck in processing too long" })
    .eq("processing_status", "processing")
    .lt("processing_started_at", staleBefore)
    .gte("processing_attempts", 3);

  await supabaseAdmin.from("whatsapp_updates")
    .update({ processing_status: "pending" })
    .eq("processing_status", "processing")
    .lt("processing_started_at", staleBefore)
      .lt("processing_attempts", 3);
  
  const { data: config, error: configError } = await supabaseAdmin
    .from("ai_provider_configs")
    .select("provider, model, encrypted_api_key")
    .eq("is_active", true)
    .single();

  if (configError || !config) {
    console.error("No active AI provider configured.");
    return { processed: 0 };
  }

  let processed = 0;

  while (true) {
    const { data: updates, error } = await supabaseAdmin.rpc(
      "claim_whatsapp_updates"
    );

    if (error) throw error;
    if (!updates?.length) break;

    await Promise.all(
      updates.map((update) => processMessage(update, config))
    );

    processed += updates.length;
  }

  return { processed };
}
