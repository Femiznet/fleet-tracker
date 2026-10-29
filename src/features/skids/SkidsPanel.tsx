"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listSkids, removeSkid, type SkidRow } from "./service";
import { SkidFormModal } from "./SkidFormModal";

const COLS = [
  { key: "skidNumber", label: "Skid Number", type: "text" },
  { key: "location", label: "Location", type: "text" },
  { key: "state", label: "State", type: "pick", options: ["good", "maintenance"] },
  { key: "status", label: "Status", type: "pick", options: ["empty", "loading", "loaded"] },
];

export function SkidsPanel() {
  const [skids, setSkids] = useState<SkidRow[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [openCol, setOpenCol] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [modal, setModal] = useState<{ skid: SkidRow | null } | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(() => { listSkids().then(setSkids).catch((e) => setError(e.message)); }, []);
  useEffect(refresh, [refresh]);

  const shown = useMemo(() => {
    const val = (s: SkidRow, k: string) => String(s[k as keyof SkidRow] ?? "");
    const list = skids.filter((s) => {
      if (!`${s.skidNumber} ${s.location}`.toLowerCase().includes(search.toLowerCase())) return false;
      return COLS.every((c) => {
        const f = filters[c.key]; if (!f) return true;
        const v = val(s, c.key);
        if (c.type === "pick") return v === f;
        return v.toLowerCase().includes(f.toLowerCase());
      });
    });
    if (sort) list.sort((a, b) => val(a, sort.key).localeCompare(val(b, sort.key)) * sort.dir);
    return list;
  }, [skids, search, filters, sort]);

  async function del(s: SkidRow) {
    if (!confirm(`Delete ${s.skidNumber}?`)) return;
    setError("");
    try { await removeSkid(s.id); refresh(); } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Tile label="Skids" value={skids.length} />
        <Tile label="Good" value={skids.filter((s) => s.state === "good").length} />
        <Tile label="Maintenance" value={skids.filter((s) => s.state === "maintenance").length} />
        <Tile label="Empty" value={skids.filter((s) => s.status === "empty").length} />
        <Tile label="Loading" value={skids.filter((s) => s.status === "loading").length} />
        <Tile label="Loaded" value={skids.filter((s) => s.status === "loaded").length} />
      </div>
      <div className="flex gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search skid, location…" className="flex-grow border rounded-lg px-3 py-1.5 text-sm" />
        <button onClick={() => setModal({ skid: null })} className="bg-blue-600 text-white text-sm px-3 rounded-lg whitespace-nowrap">+ Add skid</button>
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
                      {c.type === "pick" ? (
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
            {!shown.length && <tr><td colSpan={COLS.length + 1} className="p-6 text-center text-slate-400">No skids found.</td></tr>}
            {shown.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-3 font-bold">{s.skidNumber}</td>
                <td className="p-3">{s.location}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.state === "good" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{s.state}</span>
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{s.status}</span>
                </td>
                <td className="p-3 text-xs whitespace-nowrap text-right space-x-3">
                  <button onClick={() => setModal({ skid: s })} className="text-slate-700 font-semibold">Edit</button>
                  <button onClick={() => del(s)} className="text-red-500">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && <SkidFormModal skid={modal.skid} onClose={() => setModal(null)} onSaved={refresh} />}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return <div className="bg-white border rounded-xl p-2"><p className="text-[10px] uppercase font-bold text-slate-500">{label}</p><p className="text-lg font-black">{value}</p></div>;
}
