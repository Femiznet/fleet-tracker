"use client";
import { useEffect, useState } from "react";
import { listTripOptions, startTrip, type TripOptions } from "./service";

export function TripFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [opts, setOpts] = useState<TripOptions>({ trucks: [], drivers: [], motormates: [], managers: [], locations: [] });
  const [truckId, setTruckId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [motormateId, setMotormateId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { listTripOptions().then(setOpts).catch((e) => setError(e.message)); }, []);

  const truck = opts.trucks.find((t) => t.value === truckId);
  const fromName = truck?.locationName ?? "";
  const availableDests = opts.locations.filter((l) => l.value !== truck?.locationId);

  function onTruckChange(v: string) {
    setTruckId(v);
    const t = opts.trucks.find((x) => x.value === v);
    if (t) { setDriverId(t.driverId); setMotormateId(t.motormateId); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await startTrip({ truckId, driverId, motormateId: motormateId || undefined, managerId: managerId || undefined, destinationId });
      onSaved(); onClose();
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  const inp = "border rounded-lg px-2 py-1.5 text-sm w-full";
  const lbl = "block text-xs font-bold text-slate-600 space-y-1";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="font-bold">Start trip</h3>
          <button type="button" onClick={onClose} className="text-slate-500">✕</button>
        </div>
        <label className={lbl}>Truck *<select required value={truckId} onChange={(e) => onTruckChange(e.target.value)} className={inp}><option value="">— select —</option>{opts.trucks.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
        {truck && <p className="text-xs text-slate-500">From: {fromName}</p>}
        <label className={lbl}>Driver *<select required value={driverId} onChange={(e) => { const v = e.target.value; setDriverId(v); const d = opts.drivers.find((x) => x.value === v); if (d) setMotormateId(d.motormateId); }} className={inp}><option value="">— select —</option>{opts.drivers.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></label>
        <label className={lbl}>Motormate (optional)<select value={motormateId} onChange={(e) => setMotormateId(e.target.value)} className={inp}><option value="">None</option>{opts.motormates.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
        <label className={lbl}>Manager *<select required value={managerId} onChange={(e) => setManagerId(e.target.value)} className={inp}><option value="">— select —</option>{opts.managers.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
        <label className={lbl}>Destination *<select required value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className={inp}><option value="">— select —</option>{availableDests.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select></label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 text-slate-600">Cancel</button>
          <button disabled={busy} className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg disabled:opacity-50">{busy ? "Saving…" : "Start trip"}</button>
        </div>
      </form>
    </div>
  );
}
