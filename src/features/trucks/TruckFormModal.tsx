"use client";
import { useEffect, useState } from "react";
import { listLocationOptions } from "@/features/locations/service";
import { addTruck, listCompanyNames, updateTruck, type TruckRow, type TruckState } from "./service";

export function TruckFormModal({
  truck, onClose, onSaved,
}: {
  truck: TruckRow | null; // null = add mode
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!truck;
  const [f, setF] = useState({
    plate: truck?.plate ?? "",
    company: truck?.company ?? "",
    locationId: truck?.locationId ?? "",
    state: (truck?.state ?? "good") as TruckState,
  });
  const [locs, setLocs] = useState<{ value: string; label: string }[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([listLocationOptions(), listCompanyNames()])
      .then(([l, c]) => { setLocs(l); setCompanies(c); })
      .catch((e) => setError(e.message));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (truck) await updateTruck(truck.id, f);
      else await addTruck(f);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const inp = "border rounded-lg px-2 py-1.5 text-sm w-full";
  const lbl = "block text-xs font-bold text-slate-600 space-y-1";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="font-bold">{editing ? "Edit truck" : "Register truck"}</h3>
          <button type="button" onClick={onClose} className="text-slate-500">✕</button>
        </div>

        <label className={lbl}>
          Plate number *
          <input required value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })}
            placeholder="e.g. KJA-882-X" className={`${inp} uppercase`} />
        </label>

        <label className={lbl}>
          Company name *
          <input required list="company-list" value={f.company}
            onChange={(e) => setF({ ...f, company: e.target.value })} placeholder="Type or pick" className={inp} />
          <datalist id="company-list">{companies.map((c) => <option key={c} value={c} />)}</datalist>
        </label>

        <label className={lbl}>
          Location *
          <select required value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })} className={inp}>
            <option value="">— select —</option>
            {locs.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>

        <label className={lbl}>
          State *
          <select value={f.state} onChange={(e) => setF({ ...f, state: e.target.value as TruckState })} className={inp}>
            <option value="good">Good condition</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </label>

        {!locs.length && <p className="text-xs text-amber-600">Register a location first (Locations page).</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 text-slate-600">Cancel</button>
          <button disabled={busy} className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg disabled:opacity-50">
            {busy ? "Saving…" : editing ? "Save changes" : "Register truck"}
          </button>
        </div>
      </form>
    </div>
  );
}