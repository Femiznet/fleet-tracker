import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ListPagination from "@/components/list-pagination";
import { supabaseAdmin } from "@/lib/supabase/admin";
import PageLoading from "@/components/page-loading";
import EditStationForm from "../station/edit-station-form";
import ResendInvitationButton from "../station/resend-invitation-button";
import PlaceCreatePanel from "./place-create-panel";

const pageSize = 25;

type PlacesSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function PlacesPage({ searchParams }: { searchParams: PlacesSearchParams }) {
  return (
    <Suspense fallback={<PageLoading label="Loading places directory" />}>
      <PlacesDirectory searchParams={searchParams} />
    </Suspense>
  );
}

async function PlacesDirectory({
  searchParams,
}: {
  searchParams: PlacesSearchParams;
}) {
  await connection();
  const params = await searchParams;
  const query = singleParam(params.q).trim().slice(0, 100);
  const kindParam = singleParam(params.kind);
  const kind = kindParam === "station" || kindParam === "milestone" ? kindParam : "";
  const page = Math.max(1, Math.min(100_000, Number.parseInt(singleParam(params.page), 10) || 1));

  let request = supabaseAdmin
    .from("stations")
    .select("id, name, slug, place_kind, type, distance, location, latitude, longitude", { count: "exact" })
    .order("name", { ascending: true });

  if (query) request = request.ilike("name", `%${query}%`);
  if (kind === "station" || kind === "milestone") request = request.eq("place_kind", kind);

  const { data: places, count, error } = await request.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) console.error("Could not load places directory:", error);

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (!error && page > pageCount) {
    const url = new URLSearchParams();
    if (query) url.set("q", query);
    if (kind) url.set("kind", kind);
    if (pageCount > 1) url.set("page", String(pageCount));
    redirect(`/admin/dashboard/places?${url.toString()}`);
  }
  const currentPage = Math.min(page, pageCount);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-800">Directory</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Places</h1>
          <p className="mt-2 text-sm text-slate-600">Manage customer stations and reusable route milestones.</p>
        </div>
      </header>

      <PlaceCreatePanel />

      <form method="get" className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search places</span>
          <input type="search" name="q" defaultValue={query} placeholder="Search place name…" className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15" />
        </label>
        <label>
          <span className="sr-only">Filter place type</span>
          <select name="kind" defaultValue={kind} className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm sm:w-48">
            <option value="">All places</option>
            <option value="station">Customer stations</option>
            <option value="milestone">Route milestones</option>
          </select>
        </label>
        <button type="submit" className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50">Apply filters</button>
        {(query || kind) && <Link href="/admin/dashboard/places" className="inline-flex min-h-10 items-center justify-center px-2 text-sm text-slate-600 hover:text-slate-950">Clear</Link>}
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold">Places directory</h2>
          <p className="mt-0.5 text-sm text-slate-500">{total.toLocaleString()} places</p>
        </div>
        {error ? (
          <p role="alert" className="p-6 text-sm text-red-700">Could not load places. Refresh to try again.</p>
        ) : places?.length ? (
          <div className="divide-y divide-slate-100">
            {places.map((place) => (
              <article key={place.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{place.name}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${place.place_kind === "station" ? "bg-indigo-50 text-indigo-800" : "bg-emerald-50 text-emerald-800"}`}>
                        {place.place_kind === "station" ? "Customer station" : "Route milestone"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {[place.location, place.type, place.distance != null && `${place.distance} km`]
                        .filter(Boolean)
                        .join(" · ") || "No additional details"}
                    </p>
                    {place.latitude != null && place.longitude != null && (
                      <p className="mt-1 text-xs text-slate-500">GPS {place.latitude}, {place.longitude}</p>
                    )}
                  </div>
                  {place.place_kind === "station" && <ResendInvitationButton stationId={place.id} />}
                </div>
                <EditStationForm station={place} />
              </article>
            ))}
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <h3 className="font-medium">{query || kind ? "No places match these filters" : "No places have been created"}</h3>
            <p className="mt-1 text-sm text-slate-500">Create a customer station or route milestone above.</p>
          </div>
        )}
        {!error && <div className="p-5"><ListPagination basePath="/admin/dashboard/places" page={currentPage} pageSize={pageSize} total={total} query={query} filters={{ kind }} /></div>}
      </section>
    </div>
  );
}

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
