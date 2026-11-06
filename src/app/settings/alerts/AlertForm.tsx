"use client"

import { useActionState } from "react"
import { saveAlertPreferences, type SaveResult } from "./actions"

type Props = {
  dashboardAlerts: boolean
  whatsappAlerts: boolean
  whatsappNumber: string
}

export default function AlertForm({ dashboardAlerts, whatsappAlerts, whatsappNumber }: Props) {
  const [result, action, pending] = useActionState<SaveResult, FormData>(
    saveAlertPreferences,
    null
  )

  return (
    <form action={action} className="space-y-5 sm:space-y-6">
      <label className="flex min-h-14 items-start gap-3 rounded-xl border border-[var(--border)] p-4 transition-colors has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[var(--brand)]/5">
        <input
          type="checkbox"
          name="dashboard_alerts"
          defaultChecked={dashboardAlerts}
          className="mt-1 rounded border border-[var(--border)] bg-[var(--input-bg)] w-4 h-4 cursor-pointer accent-[var(--brand)]"
        />
        <span className="min-w-0">
          <span className="block font-medium">Dashboard alerts</span>
          <span className="mt-1 block text-sm text-[var(--muted)]">
            Show me when a customer needs a skid or is critical.
          </span>
        </span>
      </label>

      <label className="flex min-h-14 items-start gap-3 rounded-xl border border-[var(--border)] p-4 transition-colors has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[var(--brand)]/5">
        <input
          type="checkbox"
          name="whatsapp_alerts"
          defaultChecked={whatsappAlerts}
          className="mt-1 rounded border border-[var(--border)] bg-[var(--input-bg)] w-4 h-4 cursor-pointer accent-[var(--brand)]"
        />
        <span className="min-w-0">
          <span className="block font-medium">WhatsApp alerts</span>
          <span className="mt-1 block text-sm text-[var(--muted)]">
            Send me the same alerts on WhatsApp.
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="whatsapp_number" className="block font-medium text-[var(--fg)]">
          WhatsApp number
        </label>
        <input
          id="whatsapp_number"
          name="whatsapp_number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+2348012345678"
          defaultValue={whatsappNumber}
          className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-base text-[var(--fg)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 sm:text-sm"
        />
        <p className="mt-1 text-sm text-[var(--muted)]">
          Include the country code.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-[var(--brand-foreground)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        {result && (
          <p role="status" className={result.ok ? "text-[var(--success)]" : "text-[var(--destructive)]"}>
            {result.message}
          </p>
        )}
      </div>
    </form>
  )
}