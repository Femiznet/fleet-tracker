import { Inter } from "next/font/google"
import { connection } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getCustomerStatuses } from "@/lib/calc/getStatuses"
import StatusBoard from "@/components/dashboard/StatusBoard"

const plex = Inter({ subsets: ["latin"], weight: ["400", "500", "600"] })

export const instant = false

export default async function DashboardPage() {
  await connection()

  const statuses = await getCustomerStatuses()
  const generatedAt = new Date().toISOString()

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: prefs } = user
    ? await supabase
        .from("alert_preferences")
        .select("dashboard_alerts")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null }

  return (
    <main className={`${plex.className} mx-auto min-h-screen max-w-7xl px-4 py-6 text-[var(--fg)] sm:px-6 sm:py-8 lg:px-8`}>
      <header className="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--brand)]">Operations overview</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Customer monitor</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Current delivery timing and supply status for your customers.
          </p>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Updated{" "}
          {new Intl.DateTimeFormat("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Africa/Lagos",
          }).format(new Date(generatedAt))}
        </p>
      </header>
      <StatusBoard
        statuses={statuses}
        alertsOn={prefs?.dashboard_alerts ?? false}
      />
    </main>
  )
}
