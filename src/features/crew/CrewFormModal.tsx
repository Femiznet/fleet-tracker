"use client";
import { useEffect, useState } from "react";
import { addCrew, updateCrew, listLinkOptions, CREW_LABEL, type CrewKind, type CrewRow } from "./service";

export function CrewFormModal({
  kind, person, onClose, onSaved,
}: {
  kind: CrewKind;
  person: CrewRow | null; // null = add mode
  onClose: () => void;
  onSaved: () => void;
}) {
  const label = CREW_LABEL[kind].one;
  const editing = !!person;
  const [f, setF] = useState({
    name: person?.name ?? "",
    phone: person?.phone ?? "",
    motormateId: person?.motormateId ?? "",
    truckId: person?.truckId ?? "",
  });
  const [opts, setOpts] = useState<Awaited<ReturnType<typeof listLinkOptions>>>({ motormates: [], trucks: [] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (kind === "drivers") listLinkOptions().then(setOpts).catch((e) => setError(e.message));
  }, [kind]);


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (person) await updateCrew(kind, person.id, f);
      else await addCrew(kind, f);
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
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-3"
      >
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="font-bold">{editing ? `Edit ${label}` : `Register ${label}`}</h3>
          <button type="button" onClick={onClose} className="text-slate-500">✕</button>
        </div>

        <label className={lbl}>
          Full name *
          <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder="e.g. John Doe" className={inp} />
        </label>

        <label className={lbl}>
          Phone number (optional)
          <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })}
            placeholder="e.g. 0803 000 0000" inputMode="tel" className={inp} />
        </label>

        {kind === "drivers" && (
  <>
    <label className={lbl}>
      Usual motormate (optional)
      <select value={f.motormateId} onChange={(e) => setF({ ...f, motormateId: e.target.value })} className={inp}>
        <option value="">None</option>
        {opts.motormates.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
    <label className={lbl}>
      Current truck (optional)
      <select value={f.truckId} onChange={(e) => setF({ ...f, truckId: e.target.value })} className={inp}>
        <option value="">None</option>
        {opts.trucks.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
    <p className="text-xs text-slate-400">Defaults only. Change or clear them any time.</p>
  </>
        )}
        
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 text-slate-600">Cancel</button>
          <button disabled={busy} className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg disabled:opacity-50">
            {busy ? "Saving…" : editing ? "Save changes" : `Register ${label}`}
          </button>
        </div>
      </form>
    </div>
  );
}