"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listTrips, setTripStatus, removeTrip, type TripRow } from "./service";
import { TripFormModal } from "./TripFormModal";

const COLS = [
  { key: "truck", label: "Truck", type: "text" },
  { key: "driver", label: "Driver", type: "text" },
  { key: "motormate", label: "Motormate", type: "link" },
  { key: "manager", label: "Manager", type: "link" },
  { key: "from", label: "From", type: "text" },
  { key: "to", label: "To", type: "text" },
  { key: "status", label: "Status", type: "pick", options: ["in_transit", "arrived", "cancelled"] },
];

export function TripsPanel() {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [openCol, setOpenCol] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [modal, setModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<TripRow | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(() => { listTrips().then(setTrips).catch((e) => setError(e.message)); }, []);
  useEffect(refresh, [refresh]);

  const shown = useMemo(() => {
    const val = (t: TripRow, k: string) => String(t[k as keyof TripRow] ?? "");
    const list = trips.filter((t) => {
      if (!`${t.truck} ${t.driver} ${t.to}`.toLowerCase().includes(search.toLowerCase())) return false;
      return COLS.every((c) => {
        const f = filters[c.key]; if (!f) return true;
        const v = val(t, c.key);
        if (c.type === "link") return f === "has" ? !!v : !v;
        if (c.type === "pick") return v === f;
        return v.toLowerCase().includes(f.toLowerCase());
      });
    });
    if (sort) list.sort((a, b) => val(a, sort.key).localeCompare(val(b, sort.key)) * sort.dir);
    return list;
  }, [trips, search, filters, sort]);

  async function arrive(t: TripRow) { setCancelTarget(null); setError(""); try { await setTripStatus(t.id, "arrived"); refresh(); } catch (e) { setError((e as Error).message); } }
  async function cancel(t: TripRow) { setCancelTarget(t); }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Tile label="In transit" value={trips.filter((t) => t.status === "in_transit").length} />
        <Tile label="Arrived" value={trips.filter((t) => t.status === "arrived").length} />
        <Tile label="Cancelled" value={trips.filter((t) => t.status === "cancelled").length} />
      </div>
      <div className="flex gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search truck, driver, destination…" className="flex-grow border rounded-lg px-3 py-1.5 text-sm" />
        <button onClick={() => setModal(true)} className="bg-blue-600 text-white text-sm px-3 rounded-lg whitespace-nowrap">+ Start trip</button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto bg-white border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className="p-3 text-left relative">
                  <button onClick={() => setOpenCol(openCol === c.key ? null : c.key)} className="font-semibold">
                    {c.label} {sort?.key === c.key ? (sort.dir === 1 ? "↑" : "↓") : "▾"}
                  </button>
                  {openCol === c.key && (
                    <div className="absolute left-2 top-10 z-10 w-48 bg-white border rounded-xl shadow-lg p-2 space-y-2 font-normal normal-case">
                      <div className="flex gap-1 text-xs">
                        <button onClick={() => setSort({ key: c.key, dir: 1 })} className="flex-1 border rounded px-2 py-1">A → Z</button>
                        <button onClick={() => setSort({ key: c.key, dir: -1 })} className="flex-1 border rounded px-2 py-1">Z → A</button>
                      </div>
                      {c.type === "link" ? (
                        <div className="space-y-1 text-xs">
                          {[["", "All"], ["has", "Has one"], ["none", "None"]].map(([v, t]) => (
                            <label key={v} className="flex items-center gap-2">
                              <input type="radio" checked={(filters[c.key] ?? "") === v} onChange={() => { setFilters({ ...filters, [c.key]: v }); setOpenCol(null); }} />{t}
                            </label>
                          ))}
                        </div>
                      ) : c.type === "pick" ? (
                        <div className="space-y-1 text-xs">
                          {[["", "All"], ...(c.options ?? []).map((o) => [o, o])].map(([v, t]) => (
                            <label key={v} className="flex items-center gap-2">
                              <input type="radio" checked={(filters[c.key] ?? "") === v} onChange={() => { setFilters({ ...filters, [c.key]: v }); setOpenCol(null); }} />{t}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <input autoFocus value={filters[c.key] ?? ""} placeholder={`Filter ${c.label.toLowerCase()}…`} onChange={(e) => setFilters({ ...filters, [c.key]: e.target.value })} className="w-full border rounded px-2 py-1 text-xs" />
                      )}
                      <button onClick={() => { setSort(null); setFilters({ ...filters, [c.key]: "" }); setOpenCol(null); }} className="text-xs text-slate-500">Reset column</button>
                    </div>
                  )}
                </th>
              ))}
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {!shown.length && <tr><td colSpan={10} className="p-6 text-center text-slate-400">No trips found.</td></tr>}
            {shown.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-3 font-bold">{t.truck}</td>
                <td className="p-3">{t.driver}</td>
                <td className="p-3">{t.motormate || <span className="text-slate-400">none</span>}</td>
                <td className="p-3">{t.manager || <span className="text-slate-400">none</span>}</td>
                <td className="p-3">{t.from}</td>
                <td className="p-3">{t.to}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${t.status === "in_transit" ? "bg-blue-100 text-blue-800" : t.status === "arrived" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{t.status}</span>
                </td>
                <td className="p-3 text-xs whitespace-nowrap">{new Date(t.createdAt).toLocaleString()}</td>
                <td className="p-3 text-xs whitespace-nowrap">{t.completedAt ? new Date(t.completedAt).toLocaleString() : "—"}</td>
                <td className="p-3 text-xs whitespace-nowrap text-right space-x-3">
                  {t.status === "in_transit" && (
                    <>
                      <button onClick={() => arrive(t)} className="text-emerald-700 font-semibold">Arrived</button>
                      <button onClick={() => cancel(t)} className="text-red-500">Cancel</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
{cancelTarget && (
  <div
    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
    onClick={() => setCancelTarget(null)}
  >
    <div
      className="bg-white rounded-2xl p-5 space-y-3 w-full max-w-sm shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="font-bold">Cancel trip</h3>
      <p className="text-sm">
        Truck <strong>{cancelTarget.truck}</strong> to <strong>{cancelTarget.to}</strong>. Record it as cancelled, or delete it?
      </p>
      <div className="flex justify-end gap-2">
        <button onClick={() => setCancelTarget(null)} className="text-sm px-3 py-1.5 text-slate-600">Back</button>
        <button
          onClick={async () => {
            try { await setTripStatus(cancelTarget.id, "cancelled"); refresh(); } catch (e) { setError((e as Error).message); }
            setCancelTarget(null);
          }}
          className="bg-slate-600 text-white text-sm px-3 py-1.5 rounded-lg"
        >Record</button>
        <button
          onClick={async () => {
            try { await removeTrip(cancelTarget.id); refresh(); } catch (e) { setError((e as Error).message); }
            setCancelTarget(null);
          }}
          className="bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg"
        >Delete</button>
      </div>
    </div>
  </div>
)}
      {modal && <TripFormModal onClose={() => setModal(false)} onSaved={refresh} />}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return <div className="bg-white border rounded-xl p-2"><p className="text-[10px] uppercase font-bold text-slate-500">{label}</p><p className="text-lg font-black">{value}</p></div>;
}
