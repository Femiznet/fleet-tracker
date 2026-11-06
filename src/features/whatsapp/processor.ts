
import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { decryptApiKey } from "@/lib/ai/encryption";
import { validateExtraction } from "@/lib/ai/extraction-schema";
import { createPrompt } from "./config";

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

  const prompt = createPrompt(message);
  if (!prompt?.trim()) throw new Error("PROMPT is empty");
  
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
      config.encrypted_api_key,
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
        processing_status: needsReview ? "needs_review" : "processed",
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
  .in("processing_status", ["processing", "failed"])
  .lt("processing_started_at", staleBefore)
    .lt("processing_attempts", 3)
  
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

;  while (true) {
    const { data: updates, error } = await supabaseAdmin.rpc(
      "claim_whatsapp_updates"
    )

    if (error) throw error;
    if (!updates?.length) break;

    await Promise.all(
      updates.map((update) => processMessage(update, config))
    );

    processed += updates.length;
  }

  return { processed };
}
