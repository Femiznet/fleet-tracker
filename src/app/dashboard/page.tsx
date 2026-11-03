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
    <main className={`${plex.className} min-h-screen bg-[var(--bg)] text-[var(--fg)]`}>
      <StatusBoard
        statuses={statuses}
        generatedAt={new Date().toISOString()}
        alertsOn={prefs?.dashboard_alerts ?? false}
      />
    </main>
  )
}
