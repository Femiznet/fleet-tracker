"use client";
import { useCallback, useEffect, useState } from "react";
import { listLocationOptions } from "@/features/locations/service";
import { listDriverOptions, listMotormateOptions } from "@/features/pairings/service";
import {
  arriveDispatch, cancelDispatch, createDispatch, listActiveTrips, loadDispatchData,
} from "./service";

type Opt = { value: string; label: string };
type Data = Awaited<ReturnType<typeof loadDispatchData>>;
type Trip = Awaited<ReturnType<typeof listActiveTrips>>[number];

const empty = { manager: "", truck: "", driver: "", mate: "", skid: "", dest: "" };

export function DispatchPanel() {
  const [data, setData] = useState<Data>();
  const [locs, setLocs] = useState<Opt[]>([]);
  const [drivers, setDrivers] = useState<Opt[]>([]);
  const [mates, setMates] = useState<Opt[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [f, setF] = useState(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [d, l, dr, m, t] = await Promise.all([
        loadDispatchData(), listLocationOptions(), listDriverOptions(), listMotormateOptions(), listActiveTrips(),
      ]);
      setData(d); setLocs(l); setDrivers(dr); setMates(m); setTrips(t);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (!data) return <p className="text-sm text-slate-400">Loading…</p>;

  const truck = data.trucks.find((t) => t.id === f.truck);
  const originName = locs.find((l) => l.value === truck?.locationId)?.label;
  const freeTrucks = data.trucks.filter((t) => t.status !== "in_transit" && t.status !== "maintenance");
  const freeSkids = data.skids.filter(
    (s) => truck && s.locationId === truck.locationId && s.status !== "in_transit" && s.status !== "maintenance"
  );

  function pickTruck(id: string) {
    const driver = data!.driverByTruck[id] ?? "";
    const mate = driver ? data!.mateByDriver[driver] ?? "" : "";
    setF({ ...f, truck: id, driver, mate, skid: "", dest: "" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!truck) return;
    setBusy(true); setError("");
    try {
      await createDispatch({
        managerId: f.manager, truckId: f.truck, driverId: f.driver,
        motormateId: f.mate, skidId: f.skid, origin: truck.locationId, destination: f.dest,
      });
      setF(empty);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  async function act(fn: (id: string) => Promise<void>, id: string, ask?: string) {
    if (ask && !confirm(ask)) return;
    setError("");
    try { await fn(id); await refresh(); } catch (err) { setError((err as Error).message); }
  }

  const sel = "border rounded-lg px-2 py-1.5 text-sm w-full";

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="bg-white rounded-2xl border p-4 space-y-3">
        <h2 className="font-bold">New dispatch</h2>

        <Pick label="Dispatched by *" value={f.manager} onChange={(v) => setF({ ...f, manager: v })} options={data.managers} required cls={sel} />
        <Pick label="Truck *" value={f.truck} onChange={pickTruck} required cls={sel}
          options={freeTrucks.map((t) => ({ value: t.id, label: t.plate }))} />

        {truck && <p className="text-sm text-slate-600">From: <strong>{originName}</strong></p>}

        <div className="grid grid-cols-2 gap-2">
          <Pick label="Driver *" value={f.driver} onChange={(v) => setF({ ...f, driver: v })} options={drivers} required cls={sel} />
          <Pick label="Motormate (optional)" value={f.mate} onChange={(v) => setF({ ...f, mate: v })} options={mates} cls={sel} />
        </div>

        <Pick label="Skid (optional, only skids at the truck's location)" value={f.skid}
          onChange={(v) => setF({ ...f, skid: v })} cls={sel} disabled={!truck}
          options={freeSkids.map((s) => ({ value: s.id, label: `${s.skidNo} (${s.status})` }))} />

        <Pick label="Destination *" value={f.dest} onChange={(v) => setF({ ...f, dest: v })} required cls={sel}
          disabled={!truck} options={locs.filter((l) => l.value !== truck?.locationId)} />

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy || !truck} className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg disabled:opacity-50">
          Dispatch
        </button>
      </form>

      <section className="bg-white rounded-2xl border p-4">
        <h2 className="font-bold mb-2">Active trips <span className="text-slate-400 text-sm">({trips.length})</span></h2>
        {!trips.length && <p className="text-sm text-slate-400">No trucks on the road.</p>}
        <ul className="divide-y">
          {trips.map((t) => (
            <li key={t.id} className="py-3 text-sm space-y-1">
              <p><strong>{t.plate}</strong> · {t.from} → {t.to}</p>
              <p className="text-slate-500">
                {t.driver}{t.motormate ? ` + ${t.motormate}` : ""} · {t.skid ? `Skid ${t.skid}` : "no skid"} · by {t.manager} ·{" "}
                {new Date(t.createdAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
              <div className="flex gap-2 pt-1">
                <button onClick={() => act(arriveDispatch, t.id)} className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs">Arrived</button>
                <button onClick={() => act(cancelDispatch, t.id, "Cancel this trip? Truck and skid return to where they were.")}
                  className="border border-rose-300 text-rose-600 px-3 py-1 rounded-lg text-xs">Cancel</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Pick({
  label, value, onChange, options, required, disabled, cls,
}: {
  label: string; value: string; onChange: (v: string) => void; options: Opt[];
  required?: boolean; disabled?: boolean; cls: string;
}) {
  return (
    <label className="block text-xs font-bold text-slate-600 space-y-1">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled} className={cls}>
        <option value="">— select —</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}