import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AlertCircle, ArrowRight, FilePlus2, MapPin } from "lucide-react";
import PageLoading from "@/components/page-loading";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default function CustomerDashboardPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading station overview" />}>
      <CustomerOverview />
    </Suspense>
  );
}

async function CustomerOverview() {
  await connection();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw new Error(`Could not load customer account: ${authError.message}`);
  if (!user) throw new Error("Customer session is no longer available.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("station_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Could not load customer station profile:", profileError);
  }

  const stationQuery = profile?.station_id
    ? await supabase
      .from("stations")
      .select("name, location, type")
      .eq("id", profile.station_id)
      .maybeSingle()
    : { data: null, error: null };
  if (stationQuery.error) console.error("Could not load customer station:", stationQuery.error);

  const updatesQuery = profile?.station_id
    ? await supabase
      .from("station_updates")
      .select("reported_at, available_trucks, standby_skids, empty_skids, landing_gear_boxes")
      .eq("station_id", profile.station_id)
      .order("reported_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    : { data: null, error: null };
  if (updatesQuery.error) console.error("Could not load latest station report:", updatesQuery.error);

  const loadError = profileError ?? stationQuery.error ?? updatesQuery.error;
  const station = stationQuery.data;
  const latest = updatesQuery.data;

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-800">Customer workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Station overview</h1>
          <p className="mt-2 text-sm text-slate-600">View your station details and keep operational information up to date.</p>
        </div>
        <Link href="/customer/update" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800">
          <FilePlus2 aria-hidden="true" className="size-4" />
          Submit station report
        </Link>
      </header>

      {loadError && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Some station information could not be loaded. Refresh to try again.
        </p>
      )}

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-800">
              <MapPin aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-slate-500">Your station</p>
              <h2 className="mt-1 text-lg font-semibold">{station?.name ?? "Station not linked"}</h2>
              <p className="mt-1 text-sm text-slate-600">{station?.location || "Station location has not been added."}</p>
              {station?.type && <p className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{station.type}</p>}
            </div>
          </div>
          {!station && !loadError && (
            <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Contact your administrator to link your account to a customer station.
            </p>
          )}
        </article>

        <article className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold">Latest station report</h2>
            <p className="mt-0.5 text-sm text-slate-500">Most recently submitted operational snapshot.</p>
          </div>
          {latest ? (
            <>
              <dl className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
                <Summary label="Available trucks" value={latest.available_trucks.length} />
                <Summary label="Standby skids" value={latest.standby_skids.length} />
                <Summary label="Empty skids" value={latest.empty_skids.length} />
                <Summary label="Landing gear boxes" value={latest.landing_gear_boxes ?? 0} />
              </dl>
              <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                Reported <time dateTime={latest.reported_at}>{new Date(latest.reported_at).toLocaleString()}</time>
              </p>
            </>
          ) : (
            <div className="p-6">
              <p className="text-sm text-slate-600">{loadError ? "The latest report could not be loaded." : "No report has been submitted for this station yet."}</p>
              {station && <Link href="/customer/update" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-800 hover:underline">Submit first report <ArrowRight aria-hidden="true" className="size-4" /></Link>}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs leading-5 text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
