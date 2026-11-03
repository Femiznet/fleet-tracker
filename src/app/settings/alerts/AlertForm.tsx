"use client";

import { useActionState } from "react";
import { saveAlertPreferences, type SaveResult } from "./actions";

type Props = {
  dashboardAlerts: boolean;
  whatsappAlerts: boolean;
  whatsappNumber: string;
};

export default function AlertForm({ dashboardAlerts, whatsappAlerts, whatsappNumber }: Props) {
  const [result, action, pending] = useActionState<SaveResult, FormData>(
    saveAlertPreferences,
    null
  );

  return (
    <form action={action} className="space-y-6">
      <label className="flex items-start gap-3">
        <input type="checkbox" name="dashboard_alerts" defaultChecked={dashboardAlerts} className="mt-1" />
        <span>
          <span className="block font-medium">Dashboard alerts</span>
          <span className="block text-sm text-slate-600">
            Show me when a customer needs a skid or is critical.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3">
        <input type="checkbox" name="whatsapp_alerts" defaultChecked={whatsappAlerts} className="mt-1" />
        <span>
          <span className="block font-medium">WhatsApp alerts</span>
          <span className="block text-sm text-slate-600">
            Send me the same alerts on WhatsApp.
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="whatsapp_number" className="block font-medium">
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
          className="mt-1 w-full max-w-xs rounded-md border border-slate-300 px-3 py-2"
        />
        <p className="mt-1 text-sm text-slate-600">Include the country code.</p>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        {result && (
          <p role="status" className={result.ok ? "text-emerald-700" : "text-red-700"}>
            {result.message}
          </p>
        )}
      </div>
    </form>
  );
}