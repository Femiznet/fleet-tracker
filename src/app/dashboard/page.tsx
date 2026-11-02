import { IBM_Plex_Sans } from "next/font/google";
import { getCustomerStatuses } from "@/lib/calc/getStatuses";
import StatusBoard from "@/components/dashboard/StatusBoard";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const statuses = await getCustomerStatuses();

  return (
    <main className={`${plex.className} min-h-screen bg-slate-50 text-slate-900`}>
      <StatusBoard statuses={statuses} generatedAt={new Date().toISOString()} />
    </main>
  );
}