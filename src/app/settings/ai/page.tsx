
"use client";

import { useEffect, useState } from "react";
import {
  saveAiProviderAction,
  listAiProvidersAction,
  activateAiProviderAction,
  testAiProviderAction,
  deactivateAiProviderAction,
  deleteAiProviderAction,
} from "@/features/ai/actions";

type Provider = Awaited<ReturnType<typeof listAiProvidersAction>>[number];

const providerOptions = [
  "Google Gemini",
  "OpenAI",
  "Anthropic",
  "Groq",
  "OpenRouter",
  "Custom",
];

export default function AiSettingsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [provider, setProvider] = useState("Google Gemini");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadProviders() {
    try {
      setProviders(await listAiProvidersAction());
    } catch {
      setError("Unable to load AI configurations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        setProviders(await listAiProvidersAction());
      } catch {
        setError("Unable to load AI configurations.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await saveAiProviderAction({ provider, model, apiKey });
      setApiKey("");
      setModel("");
      setSuccess("Provider configuration saved.");
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save configuration.");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(id: string) {
    setError("");
    setSuccess("");

    try {
      await activateAiProviderAction(id);
      setSuccess("Active provider updated.");
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to activate provider.");
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    setError("");
    setSuccess("");

    try {
      const result = await testAiProviderAction(id);
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed.");
    } finally {
      setTestingId("");
    }
  }

  async function handleDeactivate(id: string) {
    setError("");
    setSuccess("");
  
    try {
      await deactivateAiProviderAction(id);
      setSuccess("Provider deactivated.");
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to deactivate provider.");
    }
  }
  
  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this provider configuration?")) {
      return;
    }
  
    setError("");
    setSuccess("");
  
    try {
      await deleteAiProviderAction(id);
      setSuccess("Provider configuration deleted.");
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete provider.");
    }
  }

  return (
    <main className="min-h-screen bg-[#080d18] px-5 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <p className="text-sm font-medium text-cyan-400">Configuration</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">AI Providers</h1>
          <p className="mt-2 text-sm text-slate-500">
            Configure and switch the AI services used by your operations platform.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
            {success}
          </div>
        )}

        <section className="rounded-2xl border border-white/[0.07] bg-[#101a2b] p-6 sm:p-8">
          <div className="mb-7">
            <h2 className="text-lg font-semibold">Add a provider</h2>
            <p className="mt-1 text-sm text-slate-500">
              Your API key will be encrypted before it is stored.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm text-slate-300">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#080d18] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
              >
                {providerOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Model name</label>
              <input
                required
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. gemini-2.5-flash"
                className="w-full rounded-xl border border-white/10 bg-[#080d18] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">API key</label>
              <input
                required
                type="password"
                autoComplete="new-password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your provider API key"
                className="w-full rounded-xl border border-white/10 bg-[#080d18] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50 sm:w-auto"
            >
              {saving ? "Saving..." : "Save configuration"}
            </button>
          </form>
        </section>

        <section className="mt-8 rounded-2xl border border-white/[0.07] bg-[#101a2b] p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">Saved configurations</h2>
            <p className="mt-1 text-sm text-slate-500">
              Test a provider before activating it.
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading configurations...</p>
          ) : providers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
              No providers configured yet.
            </p>
          ) : (
            <div className="space-y-3">
              {providers.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-[#080d18] p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{item.provider}</p>
                      {item.is_active && (
                        <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-400">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{item.model}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      API key stored securely
                    </p>
                  </div>

<div className="flex flex-wrap gap-2">
  <button
    onClick={() => handleTest(item.id)}
    disabled={!!testingId}
    className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-50"
  >
    {testingId === item.id ? "Testing..." : "Test connection"}
  </button>

  {item.is_active ? (
    <button
      onClick={() => handleDeactivate(item.id)}
      className="rounded-lg border border-amber-400/20 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/10"
    >
      Deactivate
    </button>
  ) : (
    <>
      <button
        onClick={() => handleActivate(item.id)}
        className="rounded-lg border border-cyan-400/20 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/10"
      >
        Activate
      </button>

      <button
        onClick={() => handleDelete(item.id)}
        className="rounded-lg border border-red-400/20 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-400/10"
      >
        Delete
      </button>
    </>
  )}
</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
