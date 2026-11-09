import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Activity, MapPinned, Truck, Waypoints } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import PageLoading from "@/components/page-loading";

const activeTripsPath = "/admin/dashboard/dispatches?status=in_transit";

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading fleet overview" />}>
      <OverviewData />
    </Suspense>
  );
}

async function OverviewData() {
  await connection();

  const [
    { count: vehicleCount, error: vehicleError },
    { count: stationCount, error: stationError },
    { count: activeTripCount, error: tripCountError },
    { data: activeTrips, error: tripsError },
  ] = await Promise.all([
    supabaseAdmin.from("vehicle_tracking").select("plate_number", { count: "exact", head: true }),
    supabaseAdmin.from("stations").select("id", { count: "exact", head: true }).eq("place_kind", "station"),
    supabaseAdmin.from("vehicle_dispatches").select("id", { count: "exact", head: true }).eq("status", "in_transit"),
    supabaseAdmin
      .from("vehicle_dispatches")
      .select("id, plate_number, destination_name, started_at")
      .eq("status", "in_transit")
      .order("started_at", { ascending: false })
      .limit(5),
  ]);

  const queryError = vehicleError ?? stationError ?? tripCountError ?? tripsError;
  if (queryError) {
    console.error("Could not load admin overview:", queryError);
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-800">CNG logistics</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Overview</h1>
          <p className="mt-2 text-sm text-slate-600">
            A quick view of fleet activity. Use the workspace navigation to manage records.
          </p>
        </div>
        <Link
          href="/admin/dashboard/dispatches"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
        >
          Manage dispatches
        </Link>
      </header>

      {queryError ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Overview data could not be fully loaded. Refresh the page to try again.
        </p>
      ) : (
        <section aria-label="Fleet summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            href="/admin/dashboard/vehicles"
            label="Synced vehicles"
            value={vehicleCount ?? 0}
            icon={<Truck aria-hidden="true" className="size-5" />}
            tone="sky"
          />
          <MetricCard
            href={activeTripsPath}
            label="Active dispatches"
            value={activeTripCount ?? 0}
            icon={<Waypoints aria-hidden="true" className="size-5" />}
            tone="emerald"
          />
          <MetricCard
            href="/admin/dashboard/places?kind=station"
            label="Customer stations"
            value={stationCount ?? 0}
            icon={<MapPinned aria-hidden="true" className="size-5" />}
            tone="indigo"
          />
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-800">
              <Activity aria-hidden="true" className="size-[18px]" />
            </span>
            <div>
              <h2 className="font-semibold">Active dispatches</h2>
              <p className="text-sm text-slate-500">The latest trips currently in transit.</p>
            </div>
          </div>
          <Link href={activeTripsPath} className="text-sm font-medium text-emerald-800 hover:underline">
            View all
          </Link>
        </div>

        {tripsError ? (
          <p role="alert" className="p-5 text-sm text-red-700">Could not load active dispatches.</p>
        ) : activeTrips?.length ? (
          <div className="divide-y divide-slate-100">
            {activeTrips.map((trip) => (
              <div key={trip.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_1.5fr_auto] sm:items-center">
                <p className="font-medium">{trip.plate_number}</p>
                <p className="text-sm text-slate-600">{trip.destination_name}</p>
                <p className="text-xs text-slate-500">
                  Started <time dateTime={trip.started_at}>{new Date(trip.started_at).toLocaleString()}</time>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <p className="font-medium">No active dispatches</p>
            <p className="mt-1 text-sm text-slate-500">New trips will appear here while they are in transit.</p>
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <QuickLink href="/admin/dashboard/vehicles" title="Vehicle directory" description="Search the fleet and inspect current GPS status." icon={<Truck aria-hidden="true" className="size-5" />} />
        <QuickLink href="/admin/dashboard/places" title="Places directory" description="Manage customer stations and route milestones." icon={<MapPinned aria-hidden="true" className="size-5" />} />
      </section>
    </div>
  );
}

function MetricCard({
  href,
  label,
  value,
  icon,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "sky" | "emerald" | "indigo";
}) {
  const tones = {
    sky: "bg-sky-50 text-sky-800",
    emerald: "bg-emerald-50 text-emerald-800",
    indigo: "bg-indigo-50 text-indigo-800",
  };
  return (
    <Link href={href} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>{icon}</span>
      <span>
        <span className="block text-sm text-slate-500">{label}</span>
        <span className="mt-1 block text-2xl font-semibold tabular-nums">{value}</span>
      </span>
    </Link>
  );
}

function QuickLink({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-sm">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700">{icon}</span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="mt-1 block text-sm text-slate-500">{description}</span>
      </span>
    </Link>
  );
}
