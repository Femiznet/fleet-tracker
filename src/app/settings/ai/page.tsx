"use client"

import { Inter } from "next/font/google"
import { useEffect, useState } from "react"
import {
  saveAiProviderAction,
  listAiProvidersAction,
  activateAiProviderAction,
  testAiProviderAction,
  deactivateAiProviderAction,
  deleteAiProviderAction,
} from "@/features/ai/actions"

type Provider = Awaited<ReturnType<typeof listAiProvidersAction>>[number]

const providerOptions = [
  "Google Gemini",
  "OpenAI",
  "Anthropic",
  "Groq",
  "OpenRouter",
  "Custom",
]

const plex = Inter({ subsets: ["latin"], weight: ["400", "500", "600"] })

export default function AiSettingsPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [provider, setProvider] = useState("Google Gemini")
  const [model, setModel] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function loadProviders() {
    try {
      setProviders(await listAiProvidersAction())
    } catch {
      setError("Unable to load AI configurations.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        setProviders(await listAiProvidersAction())
      } catch {
        setError("Unable to load AI configurations.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    setSuccess("")

    try {
      await saveAiProviderAction({ provider, model, apiKey })
      setApiKey("")
      setModel("")
      setSuccess("Provider configuration saved.")
      await loadProviders()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save configuration.")
    } finally {
      setSaving(false)
    }
  }

  async function handleActivate(id: string) {
    setError("")
    setSuccess("")

    try {
      await activateAiProviderAction(id)
      setSuccess("Active provider updated.")
      await loadProviders()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to activate provider.")
    }
  }

  async function handleTest(id: string) {
    setTestingId(id)
    setError("")
    setSuccess("")

    try {
      const result = await testAiProviderAction(id)
      setSuccess(result.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed.")
    } finally {
      setTestingId("")
    }
  }

  async function handleDeactivate(id: string) {
    setError("")
    setSuccess("")

    try {
      await deactivateAiProviderAction(id)
      setSuccess("Provider deactivated.")
      await loadProviders()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to deactivate provider.")
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this provider configuration?")) {
      return
    }
    setError("")
    setSuccess("")

    try {
      await deleteAiProviderAction(id)
      setSuccess("Provider configuration deleted.")
      await loadProviders()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete provider.")
    }
  }

  return (
    <main className={`${plex.className} min-h-screen bg-[var(--bg)] text-[var(--fg)]`}>
      <div className="px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold mb-4">AI Provider Settings</h1>

        {/* Save configuration form */}
        <section className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block text-sm font-medium [var(--muted)] mb-1">
                Provider
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm text-[var(--fg)] outline-none focus:border-[var(--brand)] focus:ring-2 focus-ring-[var(--brand)/20] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
              >
                {providerOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium [var(--muted)] mb-1">
                Model
              </label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. gemini-1.5-flash"
                className="mt-1 block w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm text-[var(--fg)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--brand)] focus:ring-2 focus-ring-[var(--brand)/20] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium [var(--muted)] mb-1">
                API key
              </label>
              <p className="mt-1 text-xs [var(--muted)]">
                Enter your API key. Never pre-filled or displayed in plain text.
              </p>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="new-password"
                placeholder="Enter your provider API key"
                className="mt-1 block w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--fg)] outline-none transition placeholder-text-[var(--muted)] focus:border-[var(--brand)] focus:ring-2 focus-ring-[var(--brand)/20] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-bold text-[var(--fg)] transition hover:bg-[var(--brand)/80] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {saving ? "Saving..." : "Save configuration"}
              </button>
            </div>
          </form>
        </section>

        {/* Active provider indicator and management */}
        <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold [var(--fg)]">Active provider</h2>
            <p className="mt-1 text-sm [var(--muted)]">
              Test a provider before activating it.
            </p>
          </div>

          {loading ? (
            <p className="text-sm [var(--muted)]">Loading configurations...</p>
          ) : providers.length === 0 ? (
            <p className="rounded-xl border rounded-border border-dashed [var(--border)] p-8 text-center text-sm [var(--muted)]">
              No providers configured yet.
            </p>
          ) : (
            <div className="space-y-3">
              {providers.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{item.provider}</p>
                      {item.is_active && (
                        <span className="rounded-full bg-[var(--success)/10] px-2 py-1 text-[10px] font-bold text-[var(--success)]">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs [var(--muted)]">{item.model}</p>
                    <p className="mt-1 text-xs [var(--muted)]">
                      API key stored securely
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleTest(item.id)}
                      disabled={!!testingId}
                      className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-semibold [var(--muted)] hover:bg-[var(--border)/5] disabled:opacity-50"
                    >
                      {testingId === item.id ? "Testing..." : "Test connection"}
                    </button>

                    {item.is_active ? (
                      <button
                        onClick={() => handleDeactivate(item.id)}
                        className="rounded-lg border border-[var(--warning)/20] px-4 py-2 text-xs font-semibold [var(--warning)] hover:bg-[var(--warning)/10]"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleActivate(item.id)}
                          className="rounded-lg border border-[var(--brand)/20] px-4 py-2 text-xs font-semibold [var(--brand)] hover:bg-[var(--brand)/10]"
                        >
                          Activate
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="rounded-lg border border-[var(--destructive)/20] px-4 py-2 text-xs font-semibold [var(--destructive)] hover:bg-[var(--destructive)/10]"
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
  )
}