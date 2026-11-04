"use client";

import { useState, useEffect } from "react";

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

export default function AiForms() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [provider, setProvider] = useState("Google Gemini");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  const handleSave = async (e: React.FormEvent) => {
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
      setError(
        err instanceof Error ? err.message : "Unable to save configuration.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id: string) => {
    setError("");
    setSuccess("");

    try {
      await activateAiProviderAction(id);
      setSuccess("Active provider updated.");
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to activate provider.");
    }
  };

  const handleTest = async (id: string) => {
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
  };

  const handleDeactivate = async (id: string) => {
    setError("");
    setSuccess("");

    try {
      await deactivateAiProviderAction(id);
      setSuccess("Provider deactivated.");
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to deactivate provider.");
    }
  };

  const handleDelete = async (id: string) => {
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
      setError(err instanceof Error ? err.message : "Unable to delete configuration.");
    }
  };

  async function loadProviders() {
    try {
      setProviders(await listAiProvidersAction());
    } catch {
      setError("Unable to load AI configurations.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="max-w-3xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-6 lg:p-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--fg)]">AI provider configurations</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Test a provider before activating it.
        </p>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading configurations...</p>
        ) : providers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
            No providers configured yet.
          </p>
        ) : (
          <div className="space-y-3">
            {providers.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="break-words font-semibold">{item.provider}</p>
                    {item.is_active && (
                      <span className="rounded-full bg-[var(--success)]/10 px-2 py-1 text-[10px] font-bold text-[var(--success)]">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">{item.model}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    API key stored securely
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleTest(item.id)}
                    disabled={!!testingId}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--fg)] hover:bg-[var(--card)] disabled:opacity-50 sm:px-4"
                  >
                    {testingId === item.id ? "Testing..." : "Test connection"}
                  </button>

                  {item.is_active ? (
                    <button
                      type="button"
                      onClick={() => handleDeactivate(item.id)}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--warning)]/30 px-3 py-2 text-xs font-semibold text-[var(--warning)] hover:bg-[var(--warning)]/10 sm:px-4"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleActivate(item.id)}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--brand)]/30 px-3 py-2 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--brand)]/10 sm:px-4"
                      >
                        Activate
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--destructive)]/30 px-3 py-2 text-xs font-semibold text-[var(--destructive)] hover:bg-[var(--destructive)]/10 sm:px-4"
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
      </div>

      <form onSubmit={handleSave} className="mt-8 border-t border-[var(--border)] pt-6">
        <h3 className="font-semibold text-[var(--fg)]">Add a provider</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">Your API key is encrypted before it is stored.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ai-provider" className="block text-sm font-medium text-[var(--fg)]">Provider</label>
          <select
            id="ai-provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-base text-[var(--fg)] outline-none transition-colors focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 sm:text-sm"
          >
            {providerOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ai-model" className="block text-sm font-medium text-[var(--fg)]">Model</label>
          <input
            id="ai-model"
            required
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. gpt-4, gemini-1.5-pro"
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-base text-[var(--fg)] outline-none transition-colors focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 placeholder:text-[var(--muted)] sm:text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="ai-api-key" className="block text-sm font-medium text-[var(--fg)]">API key</label>
          <input
            id="ai-api-key"
            required
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            autoComplete="new-password"
            placeholder="Enter API key"
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-base text-[var(--fg)] outline-none transition-colors focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 placeholder:text-[var(--muted)] sm:text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-[var(--brand-foreground)] shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
            {error}
          </div>
        )}

        {success && (
          <div role="status" className="mt-4 rounded-lg border border-[var(--success)]/20 bg-[var(--success)]/10 px-4 py-3 text-sm text-[var(--success)]">
            {success}
          </div>
        )}
      </form>
    </section>
  );
}