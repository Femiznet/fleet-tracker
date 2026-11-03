import { Inter } from "next/font/google"
import { connection } from "next/server"
import { getCustomerStatuses } from "@/lib/calc/getStatuses"
import StatusBoard from "@/components/dashboard/StatusBoard"

const plex = Inter({ subsets: ["latin"], weight: ["400", "500", "600"] })

export const instant = false

export default async function DashboardPage() {
  await connection()

  const statuses = await getCustomerStatuses()

  return (
    <main className={`${plex.className} min-h-screen bg-[var(--bg)] text-[var(--fg)]`}>
      <StatusBoard statuses={statuses} generatedAt={new Date().toISOString()} />
    </main>
  )
}
