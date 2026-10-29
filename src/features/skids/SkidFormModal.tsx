"use client";
import { useEffect, useState } from "react";
import { addSkid, updateSkid, listSkidOptions, type SkidRow, type SkidState, type SkidStatus } from "./service";

export function SkidFormModal({ skid, onClose, onSaved }: { skid: SkidRow | null; onClose: () => void; onSaved: () => void }) {
  const editing = !!skid;
  const [f, setF] = useState({ skidNumber: skid?.skidNumber ?? "", locationId: skid?.locationId ?? "", state: (skid?.state ?? "good") as SkidState, status: (skid?.status ?? "empty") as SkidStatus });
  const [locs, setLocs] = useState<{ value: string; label: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { listSkidOptions().then(setLocs).catch((e) => setError(e.message)); }, []);
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(""); try { if (skid) await updateSkid(skid.id, f); else await addSkid(f); onSaved(); onClose(); } catch (err) { setError((err as Error).message); setBusy(false); } }
  const inp = "border rounded-lg px-2 py-1.5 text-sm w-full";
  const lbl = "block text-xs font-bold text-slate-600 space-y-1";
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-2"><h3 className="font-bold">{editing ? "Edit skid" : "Register skid"}</h3><button type="button" onClick={onClose} className="text-slate-500">✕</button></div>
        <label className={lbl}>Skid number *<input required value={f.skidNumber} onChange={(e) => setF({ ...f, skidNumber: e.target.value })} className={inp} /></label>
        <label className={lbl}>Location *<select required value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })} className={inp}><option value="">— select —</option>{locs.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select></label>
        <label className={lbl}>State *<select value={f.state} onChange={(e) => setF({ ...f, state: e.target.value as SkidState })} className={inp}><option value="good">Good condition</option><option value="maintenance">Maintenance</option></select></label>
        <label className={lbl}>Status *<select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as SkidStatus })} className={inp}><option value="empty">Empty</option><option value="loading">Loading</option><option value="loaded">Loaded</option></select></label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 text-slate-600">Cancel</button>
          <button disabled={busy} className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg disabled:opacity-50">{busy ? "Saving…" : editing ? "Save changes" : "Register skid"}</button>
        </div>
      </form>
    </div>
  );
}
