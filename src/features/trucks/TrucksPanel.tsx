"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listTrucks, removeTruck, type TruckRow } from "./service";
import { TruckFormModal } from "./TruckFormModal";

const COLS: { key: string; label: string; type: "text" | "link" | "pick"; options?: string[] }[] = [
  { key: "plate", label: "Truck Plate", type: "text" },
  { key: "company", label: "Company", type: "text" },
  { key: "location", label: "Location", type: "text" },
  { key: "driver", label: "Driver", type: "link" },
  { key: "state", label: "State", type: "pick", options: ["good", "maintenance"] },
  { key: "status", label: "Status", type: "pick", options: ["standby", "assigned"] },
];

export function TrucksPanel() {
  const [trucks, setTrucks] = useState<TruckRow[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [openCol, setOpenCol] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [modal, setModal] = useState<{ truck: TruckRow | null } | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    listTrucks().then(setTrucks).catch((e) => setError(e.message));
  }, []);
  useEffect(refresh, [refresh]);

  const shown = useMemo(() => {
    const val = (t: TruckRow, k: string) => String(t[k as keyof TruckRow] ?? "");
    const list = trucks.filter((t) => {
      if (!`${t.plate} ${t.company} ${t.location}`.toLowerCase().includes(search.toLowerCase())) return false;
      return COLS.every((c) => {
        const f = filters[c.key];
        if (!f) return true;
        const v = val(t, c.key);
        if (c.type === "link") return f === "has" ? !!v : !v;
        if (c.type === "pick") return v === f;
        return v.toLowerCase().includes(f.toLowerCase());
      });
    });
    if (sort) list.sort((a, b) => val(a, sort.key).localeCompare(val(b, sort.key)) * sort.dir);
    return list;
  }, [trucks, search, filters, sort]);

  const tally = (key: (t: TruckRow) => string) => {
    const m: Record<string, number> = {};
    trucks.forEach((t) => (m[key(t)] = (m[key(t)] ?? 0) + 1));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };

  async function del(t: TruckRow) {
    if (!confirm(`Delete ${t.plate}?`)) return;
    setError("");
    try { await removeTruck(t.id); refresh(); } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Tile label="Trucks" value={trucks.length} />
        <Tile label="Good" value={trucks.filter((t) => t.state === "good").length} />
        <Tile label="Maintenance" value={trucks.filter((t) => t.state === "maintenance").length} />
      </div>

      <div className="grid sm:grid-cols-2 gap-2 text-sm">
        <Tally title="By company" rows={tally((t) => t.company)} />
        <Tally title="By location" rows={tally((t) => t.location)} />
      </div>

      <div className="flex gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search plate, company, location…"
          className="flex-grow border rounded-lg px-3 py-1.5 text-sm" />
        <button onClick={() => setModal({ truck: null })} className="bg-blue-600 text-white text-sm px-3 rounded-lg whitespace-nowrap">
          + Add truck
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

{Object.values(filters).some(Boolean) && (
  <button onClick={() => setFilters({})} className="text-xs text-blue-600 font-semibold">Clear filters</button>
)}

<div className="bg-white border rounded-2xl overflow-x-auto min-h-[18rem]">
  <table className="w-full text-sm">
    <thead className="bg-slate-50 text-left">
      <tr>
        {COLS.map((c) => (
          <th key={c.key} className="relative p-3 whitespace-nowrap">
            <button
              onClick={() => setOpenCol(openCol === c.key ? null : c.key)}
              className={`text-[11px] uppercase font-bold ${filters[c.key] ? "text-blue-600" : "text-slate-500"}`}
            >
              {c.label} {sort?.key === c.key ? (sort.dir === 1 ? "↑" : "↓") : "▾"}
            </button>
            {openCol === c.key && (
              <div className="absolute left-2 top-10 z-10 w-48 bg-white border rounded-xl shadow-lg p-2 space-y-2 font-normal normal-case">
                <div className="flex gap-1 text-xs">
                  <button onClick={() => setSort({ key: c.key, dir: 1 })} className="flex-1 border rounded px-2 py-1">A → Z</button>
                  <button onClick={() => setSort({ key: c.key, dir: -1 })} className="flex-1 border rounded px-2 py-1">Z → A</button>
                </div>
                {c.type === "text" ? (
                  <input autoFocus value={filters[c.key] ?? ""} placeholder={`Filter ${c.label.toLowerCase()}…`}
                    onChange={(e) => setFilters({ ...filters, [c.key]: e.target.value })}
                    className="w-full border rounded px-2 py-1 text-xs" />
                ) : (
                  <div className="space-y-1 text-xs">
                    {(c.type === "link"
                      ? [["", "All"], ["has", "Has one"], ["none", "None"]]
                      : [["", "All"], ...(c.options ?? []).map((o) => [o, o[0].toUpperCase() + o.slice(1)])]
                    ).map(([v, t]) => (
                      <label key={v} className="flex items-center gap-2">
                        <input type="radio" checked={(filters[c.key] ?? "") === v}
                          onChange={() => { setFilters({ ...filters, [c.key]: v }); setOpenCol(null); }} />
                        {t}
                      </label>
                    ))}
                  </div>
                )}
                <button onClick={() => { setSort(null); setFilters({ ...filters, [c.key]: "" }); setOpenCol(null); }}
                  className="text-xs text-slate-500">Reset column</button>
              </div>
            )}
          </th>
        ))}
        <th className="p-3" />
      </tr>
    </thead>
    <tbody>
      {!shown.length && (
        <tr><td colSpan={COLS.length + 1} className="p-6 text-center text-slate-400">No trucks found.</td></tr>
      )}
      {shown.map((t) => (
        <tr key={t.id} className="border-t">
          <td className="p-3 font-bold">{t.plate}</td>
          <td className="p-3">{t.company}</td>
          <td className="p-3">{t.location}</td>
          <td className="p-3">{t.driver || <span className="text-slate-400">none</span>}</td>
          <td className="p-3">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${t.state === "good" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
              {t.state}
            </span>
          </td>
          <td className="p-3">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${t.status === "assigned" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"}`}>
              {t.status}
            </span>
          </td>
          <td className="p-3 text-xs whitespace-nowrap text-right space-x-3">
            <button onClick={() => setModal({ truck: t })} className="text-slate-700 font-semibold">Edit</button>
            <button onClick={() => del(t)} className="text-red-500">Delete</button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

      {modal && (
        <TruckFormModal
          key={modal.truck?.id ?? "new"}
          truck={modal.truck}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border rounded-xl p-2">
      <p className="text-[10px] uppercase font-bold text-slate-500">{label}</p>
      <p className="text-lg font-black">{value}</p>
    </div>
  );
}

function Tally({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div className="bg-white border rounded-xl p-3">
      <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">{title}</p>
      {!rows.length && <p className="text-slate-400">—</p>}
      {rows.map(([k, n]) => (
        <p key={k} className="flex justify-between"><span>{k}</span><strong>{n}</strong></p>
      ))}
    </div>
  );
}