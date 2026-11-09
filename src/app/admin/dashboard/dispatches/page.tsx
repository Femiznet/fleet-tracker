import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Plus, Waypoints } from "lucide-react";
import ListPagination from "@/components/list-pagination";
import RealtimeRefresh from "@/components/realtime-refresh";
import PageLoading from "@/components/page-loading";
import { supabaseAdmin } from "@/lib/supabase/admin";
import StartDispatchForm from "./start-dispatch-form";
import TripManagement from "../dispatch/trip-management";

const pageSize = 20;
const tripStatuses = ["in_transit", "arrived", "cancelled"] as const;
type TripStatus = (typeof tripStatuses)[number];

type DispatchSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function DispatchesPage({ searchParams }: { searchParams: DispatchSearchParams }) {
  return (
    <Suspense fallback={<PageLoading label="Loading dispatch register" />}>
      <DispatchRegister searchParams={searchParams} />
    </Suspense>
  );
}

async function DispatchRegister({
  searchParams,
}: {
  searchParams: DispatchSearchParams;
}) {
  await connection();
  const params = await searchParams;
  const statusValue = singleParam(params.status);
  const status = tripStatuses.includes(statusValue as TripStatus) ? statusValue as TripStatus : "in_transit";
  const query = singleParam(params.q).trim().slice(0, 100);
  const page = Math.max(1, Math.min(100_000, Number.parseInt(singleParam(params.page), 10) || 1));

  let dispatchQuery = supabaseAdmin
    .from("vehicle_dispatches")
    .select("id, plate_number, customer_station_id, destination_name, destination_lat, destination_lon, start_lat, start_lon, started_at, status, arrived_at", { count: "exact" })
    .eq("status", status)
    .order("started_at", { ascending: false });
  if (query) dispatchQuery = dispatchQuery.ilike("plate_number", `%${query.replace(/[\\%_]/g, "\\$&")}%`);

  const { data: dispatches, count, error } = await dispatchQuery.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) console.error("Could not load dispatch list:", error);

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (!error && page > pageCount) {
    const url = new URLSearchParams();
    url.set("status", status);
    if (query) url.set("q", query);
    if (pageCount > 1) url.set("page", String(pageCount));
    redirect(`/admin/dashboard/dispatches?${url.toString()}`);
  }

  const plates = status === "in_transit" ? dispatches?.map((dispatch) => dispatch.plate_number) ?? [] : [];
  const { data: vehicles, error: vehiclesError } = plates.length
    ? await supabaseAdmin
      .from("vehicle_tracking")
      .select("plate_number, current_address, lat, lon, approaching_next, speed, remaining_distance_km, last_sync")
      .in("plate_number", plates)
    : { data: [], error: null };
  if (vehiclesError) console.error("Could not load vehicle positions for dispatches:", vehiclesError);

  const vehicleByPlate = new Map((vehicles ?? []).map((vehicle) => [vehicle.plate_number, vehicle]));

  return (
    <div className="space-y-6">
      {status === "in_transit" && <RealtimeRefresh table="vehicle_tracking" />}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-800">Fleet operations</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Dispatches</h1>
          <p className="mt-2 text-sm text-slate-600">Create trips and manage progress without crowding the fleet overview.</p>
        </div>
      </header>

      <details id="new-dispatch" className="group rounded-xl border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-5 [&::-webkit-details-marker]:hidden">
          <span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-800"><Plus aria-hidden="true" className="size-5" /></span>
          <span className="flex-1">
            <span className="block font-medium">Start a vehicle dispatch</span>
            <span className="mt-0.5 block text-sm text-slate-500">Search for a vehicle and a customer station with coordinates.</span>
          </span>
          <span className="text-sm text-slate-500 group-open:hidden">Open</span>
          <span className="hidden text-sm text-slate-500 group-open:inline">Close</span>
        </summary>
        <div className="border-t border-slate-200 p-4 sm:p-5"><StartDispatchForm /></div>
      </details>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Trip register</h2>
              <p className="mt-0.5 text-sm text-slate-500">Showing {total.toLocaleString()} {status === "in_transit" ? "active" : status} trips.</p>
            </div>
          </div>
          <nav aria-label="Dispatch status" className="mt-4 flex gap-5 overflow-x-auto">
            {tripStatuses.map((item) => (
              <Link
                key={item}
                href={`/admin/dashboard/dispatches?status=${item}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                aria-current={status === item ? "page" : undefined}
                className={`border-b-2 pb-3 text-sm font-medium capitalize ${status === item ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500 hover:text-slate-900"}`}
              >
                {item.replace("_", " ")}
              </Link>
            ))}
          </nav>
        </div>

        <form method="get" className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/60 p-4 sm:flex-row">
          <input type="hidden" name="status" value={status} />
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search by vehicle plate</span>
            <input name="q" type="search" defaultValue={query} placeholder="Search vehicle plate…" className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15" />
          </label>
          <button type="submit" className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50">Search trips</button>
          {query && <Link href={`/admin/dashboard/dispatches?status=${status}`} className="inline-flex min-h-10 items-center px-2 text-sm text-slate-600 hover:text-slate-950">Clear</Link>}
        </form>

        {error ? (
          <p role="alert" className="p-6 text-sm text-red-700">Could not load dispatches. Refresh to try again.</p>
        ) : dispatches?.length ? (
          <div className="divide-y divide-slate-100">
            {dispatches.map((dispatch) => {
              const vehicle = vehicleByPlate.get(dispatch.plate_number);
              return (
                <article key={dispatch.id} className="px-5 py-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr_1fr_auto] sm:items-center">
                    <div>
                      <p className="font-semibold">{dispatch.plate_number}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Started <time dateTime={dispatch.started_at}>{new Date(dispatch.started_at).toLocaleString()}</time>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Destination</p>
                      <p className="mt-0.5 text-sm font-medium">{dispatch.destination_name}</p>
                    </div>
                    <div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status === "in_transit" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                        {status === "in_transit" ? "In transit" : status === "arrived" ? "Completed" : "Cancelled"}
                      </span>
                    </div>
                    {status === "in_transit" && <span className="text-xs text-slate-500">Trip controls below</span>}
                  </div>
                  {status === "in_transit" && (
                    <details id={`manage-${dispatch.id}`} className="mt-4 rounded-lg border border-slate-200">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700">
                        Movement, update, and trip controls
                      </summary>
                      <div className="border-t border-slate-200 p-4">
                        {vehicle ? (
                          <TripManagement
                            dispatch={dispatch}
                            vehicle={vehicle}
                          />
                        ) : (
                          <p role="alert" className="text-sm text-red-700">Current vehicle telemetry is unavailable.</p>
                        )}
                      </div>
                    </details>
                  )}
                  {status !== "in_transit" && dispatch.arrived_at && (
                    <p className="mt-2 text-xs text-slate-500">Completed <time dateTime={dispatch.arrived_at}>{new Date(dispatch.arrived_at).toLocaleString()}</time></p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <Waypoints aria-hidden="true" className="mx-auto size-7 text-slate-400" />
            <h3 className="mt-3 font-medium">No {status.replace("_", " ")} dispatches</h3>
            <p className="mt-1 text-sm text-slate-500">{query ? "Try another plate number." : "Dispatches in this status will appear here."}</p>
          </div>
        )}
        {!error && <div className="p-5"><ListPagination basePath="/admin/dashboard/dispatches" page={page} pageSize={pageSize} total={total} query={query} filters={{ status }} /></div>}
      </section>
    </div>
  );
}

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
