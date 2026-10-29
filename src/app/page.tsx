"use client";
import { useEffect, useState } from "react";
import { listTrucks } from "@/features/trucks/service";
import { listSkids } from "@/features/skids/service";
import { listCrew } from "@/features/crew/service";
import { listTrips } from "@/features/trips/service";
import Link from "next/link";

export default function Home() {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [skids, setSkids] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [motormates, setMotormates] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  useEffect(() => {
    Promise.all([listTrucks(), listSkids(), listCrew("drivers"), listCrew("motormates"), listTrips()])
      .then(([t, s, d, m, tr]) => { setTrucks(t); setSkids(s); setDrivers(d); setMotormates(m); setTrips(tr); })
      .catch(() => {});
  }, []);
  const inTransit = trips.filter((x) => x.status === "in_transit");
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-black">Dashboard</h1>
      <div className="grid sm:grid-cols-4 gap-2 text-center">
        <Tile label="Trucks" value={trucks.length} />
        <Tile label="Skids" value={skids.length} />
        <Tile label="Drivers" value={drivers.length} />
        <Tile label="Motormates" value={motormates.length} />
        <Tile label="In transit" value={inTransit.length} />
      </div>
      <section className="bg-white border rounded-xl p-3">
        <h2 className="font-bold mb-2">Active trips</h2>
        {!inTransit.length && <p className="text-sm text-slate-400">No trucks on the road.</p>}
        <ul className="divide-y">
          {inTransit.slice(0, 5).map((t) => (
            <li key={t.id} className="py-2 text-sm">
              <strong>{t.truck}</strong> · {t.driver} · {t.from} → {t.to}
            </li>
          ))}
        </ul>
      </section>
      <section className="bg-white border rounded-xl p-3">
        <h2 className="font-bold mb-2">Fleet status</h2>
        <p className="text-sm">Trucks good: {trucks.filter((t) => t.state === "good").length} · maintenance: {trucks.filter((t) => t.state === "maintenance").length}</p>
        <p className="text-sm">Skids good: {skids.filter((s) => s.state === "good").length} · maintenance: {skids.filter((s) => s.state === "maintenance").length}</p>
      </section>
      <div className="flex gap-2 text-sm">
        <Link href="/fleet" className="text-blue-600">Fleet</Link>
        <Link href="/crew" className="text-blue-600">Crew</Link>
        <Link href="/trips" className="text-blue-600">Trips</Link>
      </div>
    </main>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return <div className="bg-white border rounded-xl p-2"><p className="text-[10px] uppercase font-bold text-slate-500">{label}</p><p className="text-lg font-black">{value}</p></div>;
}
