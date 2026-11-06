import { redirect } from "next/navigation"
import { connection } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import AlertForm from "./AlertForm"

export const instant = false

export default async function AlertSettingsPage() {
  await connection()

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: prefs } = await supabase
    .from("alert_preferences")
    .select("dashboard_alerts, whatsapp_alerts, whatsapp_number")
    .eq("user_id", user.id)
    .maybeSingle()

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 text-[var(--fg)] sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-6 sm:mb-8">
        <p className="text-sm font-medium text-[var(--brand)]">Preferences</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Alert settings</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Choose which operational updates you want to receive.
        </p>
      </header>
      <section className="max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-6">
        <AlertForm
          dashboardAlerts={prefs?.dashboard_alerts ?? false}
          whatsappAlerts={prefs?.whatsapp_alerts ?? false}
          whatsappNumber={prefs?.whatsapp_number ?? ""}
        />
      </section>
    </main>
  )
}