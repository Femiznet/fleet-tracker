import { connection } from "next/server";
import { Suspense } from "react";
import SignOutButton from "@/components/sign-out-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CreateStationForm from "./create-station-form";
import EditStationForm from "./edit-station-form";

async function StationList() {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data: stations, error } = await supabase
    .from("stations")
    .select("id, name, slug, type, distance, location")
    .order("name");

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Stations</h2>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          Could not load stations: {error.message}
        </p>
      ) : stations.length === 0 ? (
        <p className="text-sm opacity-70">No stations have been created yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {stations.map((station) => (
            <li
              key={station.id}
              className="rounded-xl border border-[var(--border)] p-4"
            >
              <h3 className="font-semibold">{station.name}</h3>
              <p className="mt-1 text-sm opacity-70">{station.slug}</p>
              <p className="mt-2 text-sm">
                {[
                  station.type,
                  station.location,
                  station.distance != null && `${station.distance} km`,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No additional station details"}
              </p>
              <EditStationForm station={station} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6 sm:p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="mt-2 text-sm opacity-70">
            Create customer stations and invite customers to set up their accounts.
          </p>
        </div>
        <SignOutButton />
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Add a customer station</h2>
        <CreateStationForm />
      </section>

      <Suspense fallback={<p className="text-sm opacity-70">Loading stations...</p>}>
        <StationList />
      </Suspense>
    </main>
  );
}
