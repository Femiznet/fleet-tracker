import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import ListPagination from "@/components/list-pagination";
import PageLoading from "@/components/page-loading";
import VehicleTable from "./vehicle-table";

const pageSize = 25;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function VehiclesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageLoading label="Loading vehicle directory" />}>
      <VehicleDirectory searchParams={searchParams} />
    </Suspense>
  );
}

async function VehicleDirectory({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;
  const query = singleParam(params.q).trim().slice(0, 100);
  const statusParam = singleParam(params.status);
  const status = statusParam === "moving" || statusParam === "stopped" ? statusParam : "";
  const page = Math.max(1, Math.min(100_000, Number.parseInt(singleParam(params.page), 10) || 1));

  let request = supabaseAdmin
    .from("vehicle_tracking")
    .select("plate_number, fleet_owner, status, speed, current_address, destination_name, remaining_distance_km, last_sync", { count: "exact" })
    .order("plate_number", { ascending: true });

  if (query) request = request.ilike("plate_number", `%${query}%`);
  if (status === "moving") request = request.or("speed.gt.0,status.eq.moving,status.eq.running");
  if (status === "stopped") request = request.eq("speed", 0).not("status", "in", "(moving,running)");

  const { data, count, error } = await request.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) {
    console.error("Could not load vehicle directory:", error);
  }

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (!error && page > pageCount) {
    const url = new URLSearchParams();
    if (query) url.set("q", query);
    if (status) url.set("status", status);
    if (pageCount > 1) url.set("page", String(pageCount));
    redirect(`/admin/dashboard/vehicles?${url.toString()}`);
  }
  const currentPage = Math.min(page, pageCount);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-800">Fleet operations</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Vehicles</h1>
          <p className="mt-2 text-sm text-slate-600">Search and monitor vehicle location, movement, and assignment.</p>
        </div>
        <Link href="/admin/dashboard/dispatches" className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
          Start a dispatch
        </Link>
      </header>

      <form method="get" className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search by plate number</span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search plate number…"
            className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
          />
        </label>
        <label>
          <span className="sr-only">Filter by movement</span>
          <select name="status" defaultValue={status} className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm sm:w-44">
            <option value="">All movement</option>
            <option value="moving">Moving</option>
            <option value="stopped">Stopped</option>
          </select>
        </label>
        <button type="submit" className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50">Apply filters</button>
        {(query || status) && <Link href="/admin/dashboard/vehicles" className="inline-flex min-h-10 items-center justify-center px-2 text-sm text-slate-600 hover:text-slate-950">Clear</Link>}
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-semibold">Fleet directory</h2>
            <p className="mt-0.5 text-sm text-slate-500">{total.toLocaleString()} vehicles</p>
          </div>
          <span className="text-xs text-slate-500">Updates automatically</span>
        </div>
        {error ? (
          <p role="alert" className="p-6 text-sm text-red-700">Could not load vehicle data. Refresh to try again.</p>
        ) : data?.length ? (
          <VehicleTable vehicles={data} />
        ) : (
          <div className="px-5 py-12 text-center">
            <h3 className="font-medium">{query || status ? "No vehicles match these filters" : "No vehicles synced yet"}</h3>
            <p className="mt-1 text-sm text-slate-500">Try changing the search or movement filter.</p>
          </div>
        )}
        {!error && <div className="p-5"><ListPagination basePath="/admin/dashboard/vehicles" page={currentPage} pageSize={pageSize} total={total} query={query} filters={{ status }} /></div>}
      </section>
    </div>
  );
}

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
