import { Inter } from "next/font/google"
import { connection } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getCustomerStatuses } from "@/lib/calc/getStatuses"
import StatusBoard from "@/components/dashboard/StatusBoard"
import { supabaseAdmin } from "@/lib/supabase/admin"
import UpdatesPanel from "@/components/dashboard/UpdatesPanel"
import ProcessingStatusCard from "@/components/dashboard/ProcessingStatusCard"

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

  // Total customer count (all customers, active and inactive)
  const { count: totalCustomers } = await supabaseAdmin
    .from("customers")
    .select("*", { count: "exact", head: true })

  // Active customers and those missing trip time
  const { data: allCustomers } = await supabaseAdmin
    .from("customers")
    .select("id, active, trip_minutes")

  const activeCustomers = (allCustomers ?? []).filter((c) => c.active).length
  const missingTrip = (allCustomers ?? []).filter((c) => c.active && c.trip_minutes === null).length

  // Fetch recent WhatsApp updates (last 24h)
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: updatesData } = await supabaseAdmin
    .from("whatsapp_updates")
    .select("id, group_name, notification_title, received_at, extracted_data, processing_status, message, review_reason")
    .in("processing_status", ["completed", "needs_review", "failed", "pending", "processing"])
    .gte("received_at", since)
    .order("received_at", { ascending: false })
    .limit(50);

  // Fetch all customers for registration check
  const { data: allCustomersData } = await supabaseAdmin
    .from("customers")
    .select("id, name, group_name, active");

  const customerGroups = new Set(
    (allCustomersData ?? []).map((c) => c.group_name)
  );
  const customerNames = new Set(
    (allCustomersData ?? []).map((c) => c.name.toLowerCase())
  );

  // Separate updates into registered and unregistered
  // Use notification_title (WhatsApp group name) for matching, fall back to extracted customer_name
  const registeredUpdates: {
    id: string;
    group_name: string | null;
    notification_title: string | null;
    received_at: string;
    extracted_data: Record<string, unknown> | null;
    processing_status: string;
    message: string;
    review_reason: string | null;
  }[] = [];
  const unregisteredUpdates: {
    id: string;
    group_name: string | null;
    notification_title: string | null;
    received_at: string;
    extracted_data: Record<string, unknown> | null;
    processing_status: string;
    message: string;
    review_reason: string | null;
  }[] = [];
  const seenUnregistered = new Set<string>();

  for (const u of updatesData ?? []) {
    const groupName = u.notification_title || u.group_name;
    const extracted = u.extracted_data as Record<string, unknown> | null;
    const customerName = (extracted?.customer_name as string) || null;

    const isRegistered =
      (groupName && customerGroups.has(groupName)) ||
      (customerName && customerNames.has(customerName.toLowerCase()));

    const update = {
      id: u.id,
      group_name: u.group_name,
      notification_title: u.notification_title,
      received_at: u.received_at,
      extracted_data: extracted,
      processing_status: u.processing_status,
      message: u.message,
      review_reason: u.review_reason,
    };

    if (isRegistered) {
      registeredUpdates.push(update);
    } else if (groupName && !seenUnregistered.has(groupName)) {
      seenUnregistered.add(groupName);
      unregisteredUpdates.push(update);
    } else if (customerName && !seenUnregistered.has(customerName)) {
      seenUnregistered.add(customerName);
      unregisteredUpdates.push(update);
    }
  }

  // Status breakdown from statuses
  const statusCounts = {
    critical: statuses.filter((s) => s.status === "critical").length,
    send_now: statuses.filter((s) => s.status === "send_now").length,
    soon: statuses.filter((s) => s.status === "soon").length,
    ok: statuses.filter((s) => s.status === "ok").length,
    unknown: statuses.filter((s) => s.status === "unknown").length,
  }

  // Processing status counts (last 24h)
  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: processingData } = await supabaseAdmin
    .from("whatsapp_updates")
    .select("processing_status")
    .gte("received_at", since24h);

  const processingCounts = {
    pending: (processingData ?? []).filter((u) => u.processing_status === "pending").length,
    processing: (processingData ?? []).filter((u) => u.processing_status === "processing").length,
    failed: (processingData ?? []).filter((u) => u.processing_status === "failed").length,
    completed: (processingData ?? []).filter((u) => u.processing_status === "completed").length,
  };

  return (
    <main className={`${plex.className} mx-auto min-h-screen max-w-7xl px-4 py-6 text-[var(--fg)] sm:px-6 sm:py-8 lg:px-8`}>
      <header className="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--brand)]">Operations overview</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Customer monitor</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Quick summary and customer status overview.
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

      {/* Customer Summary Card */}
      <section className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Customer summary</h2>
          <span className="rounded-full bg-[var(--brand)]/10 px-3 py-1 text-xs font-medium text-[var(--brand)]">
            {totalCustomers ?? 0} total
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <p className="text-xs font-medium text-[var(--muted)]">Total customers</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{totalCustomers ?? 0}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <p className="text-xs font-medium text-[var(--muted)]">Active</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--success)]">{activeCustomers}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <p className="text-xs font-medium text-[var(--muted)]">Inactive</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--muted)]">{(totalCustomers ?? 0) - activeCustomers}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <p className="text-xs font-medium text-[var(--muted)]">Missing trip time</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--warning)]">{missingTrip}</p>
          </div>
        </div>

        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <p className="mb-2 text-xs font-medium text-[var(--muted)]">Status breakdown</p>
          <div className="flex flex-wrap gap-2">
            {statusCounts.critical > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--critical)]/10 px-3 py-1 text-xs font-medium text-[var(--critical)]">
                <span className="size-1.5 rounded-full bg-[var(--critical)]" />
                {statusCounts.critical} critical
              </span>
            )}
            {statusCounts.send_now > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--warning)]/10 px-3 py-1 text-xs font-medium text-[var(--warning)]">
                <span className="size-1.5 rounded-full bg-[var(--warning)]" />
                {statusCounts.send_now} send now
              </span>
            )}
            {statusCounts.soon > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--muted)]/10 px-3 py-1 text-xs font-medium text-[var(--muted)]">
                <span className="size-1.5 rounded-full bg-[var(--muted)]" />
                {statusCounts.soon} soon
              </span>
            )}
            {statusCounts.ok > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success)]/10 px-3 py-1 text-xs font-medium text-[var(--success)]">
                <span className="size-1.5 rounded-full bg-[var(--success)]" />
                {statusCounts.ok} ok
              </span>
            )}
            {statusCounts.unknown > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--neutral)]/10 px-3 py-1 text-xs font-medium text-[var(--neutral)]">
                <span className="size-1.5 rounded-full bg-[var(--neutral)]" />
                {statusCounts.unknown} unknown
              </span>
            )}
            {statuses.length === 0 && (
              <span className="text-xs text-[var(--muted)]">No active customers with status data.</span>
            )}
          </div>
        </div>
      </section>
      <UpdatesPanel
        registered={registeredUpdates}
        unregistered={unregisteredUpdates}
        customers={(allCustomersData ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          group_name: c.group_name,
        }))}
      />
      <ProcessingStatusCard
        pending={processingCounts.pending}
        processing={processingCounts.processing}
        failed={processingCounts.failed}
        completed={processingCounts.completed}
      />
      <StatusBoard
        statuses={statuses}
        alertsOn={prefs?.dashboard_alerts ?? false}
      />
    </main>
  )
}
