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
    <form action={action} className="space-y-6">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="dashboard_alerts"
          defaultChecked={dashboardAlerts}
          className="mt-1 rounded border border-[var(--border)] bg-[var(--input-bg)] w-4 h-4 cursor-pointer accent-[var(--brand)]"
        />
        <span>
          <span className="block font-medium">Dashboard alerts</span>
          <span className="block text-sm [var(--muted)]">
            Show me when a customer needs a skid or is critical.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="whatsapp_alerts"
          defaultChecked={whatsappAlerts}
          className="mt-1 rounded border border-[var(--border)] bg-[var(--input-bg)] w-4 h-4 cursor-pointer accent-[var(--brand)]"
        />
        <span>
          <span className="block font-medium">WhatsApp alerts</span>
          <span className="block text-sm [var(--muted)]">
            Send me the same alerts on WhatsApp.
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="whatsapp_number" className="block font-medium [var(--muted)]">
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
          className="mt-1 block w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)] outline-none transition placeholder:[var(--muted)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)/20]"
        />
        <p className="mt-1 text-sm [var(--muted)]">
          Include the country code.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md px-4 py-2 text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--border)/5] disabled:cursor-not-allowed disabled:opacity-60"
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