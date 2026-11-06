import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/ai/require-admin";
import { encryptApiKey } from "@/lib/ai/encryption";

type SaveProviderInput = {
  provider: string;
  model: string;
  apiKey: string;
};

export async function saveAiProvider(input: SaveProviderInput) {
  await requireAdmin();

  const provider = input.provider.trim().toLowerCase();
  const model = input.model.trim();
  const apiKey = input.apiKey.trim();

  if (!provider || !model || !apiKey) {
    throw new Error("Provider, model, and API key are required");
  }

  const { data, error } = await supabaseAdmin
    .from("ai_provider_configs")
    .upsert(
      {
        provider,
        model,
        encrypted_api_key: apiKey, //encryptApiKey(apiKey),
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,model" }
    )
    .select("id, provider, model, enabled, is_active")
    .single();

  if (error) throw error;

  return data;
}

export async function listAiProviders() {
  await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("ai_provider_configs")
    .select("id, provider, model, enabled, is_active, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}

export async function activateAiProvider(id: string) {
  await requireAdmin();

  const { data: target, error: findError } = await supabaseAdmin
    .from("ai_provider_configs")
    .select("id")
    .eq("id", id)
    .eq("enabled", true)
    .maybeSingle();

  if (findError) throw findError;
  if (!target) throw new Error("Enabled provider configuration not found");

  const { error: deactivateError } = await supabaseAdmin
    .from("ai_provider_configs")
    .update({ is_active: false })
    .eq("is_active", true);

  if (deactivateError) throw deactivateError;

  const { data, error } = await supabaseAdmin
    .from("ai_provider_configs")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, provider, model, enabled, is_active")
    .single();

  if (error) throw error;

  return data;
}

export async function deactivateAiProvider(id: string) {
  await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("ai_provider_configs")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("is_active", true)
    .select("id, provider, model, enabled, is_active")
    .single();

  if (error) throw error;

  return data;
}

export async function deleteAiProvider(id: string) {
  await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("ai_provider_configs")
    .delete()
    .eq("id", id)
    .eq("is_active", false)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Provider not found or cannot be deleted while active.");
  }

  return { success: true };
}

// test
import { decryptApiKey } from "@/lib/ai/encryption";

export async function testAiProvider(id: string) {
  await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("ai_provider_configs")
    .select("provider, model, encrypted_api_key")
    .eq("id", id)
    .single();

  if (error || !data) throw new Error("Provider configuration not found");

  const apiKey = decryptApiKey(data.encrypted_api_key);
  const provider = data.provider.toLowerCase();

  let url: string;
  let headers: Record<string, string>;
  let body: object;

  if (provider === "google gemini") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(data.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    headers = { "Content-Type": "application/json" };
    body = {
      contents: [{ parts: [{ text: "Reply with OK." }] }],
      generationConfig: { maxOutputTokens: 10 },
    };
  } else if (provider === "anthropic") {
    url = "https://api.anthropic.com/v1/messages";
    headers = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
    body = {
      model: data.model,
      max_tokens: 10,
      messages: [{ role: "user", content: "Reply with OK." }],
    };
  } else {
    const endpoints: Record<string, string> = {
      openai: "https://api.openai.com/v1/chat/completions",
      groq: "https://api.groq.com/openai/v1/chat/completions",
      openrouter: "https://openrouter.ai/api/v1/chat/completions",
    };

    const endpoint = endpoints[provider];

    if (!endpoint) {
      throw new Error("Connection testing is not supported for this provider yet");
    }

    url = endpoint;
    headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    body = {
      model: data.model,
      messages: [{ role: "user", content: "Reply with OK." }],
      max_tokens: 10,
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Provider test failed (HTTP ${response.status})`);
  }

  return { success: true, message: "Connection successful" };
}