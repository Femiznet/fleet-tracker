"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CREW_LABEL, listCrew, removeCrew, type CrewKind, type CrewRow } from "./service";
import { CrewFormModal } from "./CrewFormModal";

export function CrewPanel({ kind }: { kind: CrewKind }) {
  const { one, many } = CREW_LABEL[kind];
  const [people, setPeople] = useState<CrewRow[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ person: CrewRow | null } | null>(null);
  const [error, setError] = useState("");
  const [crew, setCrew] = useState({
    drivers: { total: 0, free: 0 },
    motormates: { total: 0, free: 0 },
    managers: { total: 0 },
  });
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [openCol, setOpenCol] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const cols =
    kind === "drivers"
      ? [
          { key: "name", label: "Driver Name", link: false },
          { key: "phone", label: "Phone Number", link: false },
          { key: "truckPlate", label: "Truck", link: true },
          { key: "motormateName", label: "Motormate", link: true },
        ]
      : [
          { key: "name", label: kind === "managers" ? "Manager Name" : "Motormate Name", link: false },
          { key: "phone", label: "Phone Number", link: false },
          ...(kind === "motormates" ? [{ key: "driverName", label: "Driver", link: true }] : []),
        ];

  useEffect(() => { setFilters({}); setSort(null); setOpenCol(null); }, [kind]);

  const refresh = useCallback(() => {
    listCrew(kind).then(setPeople).catch((e) => setError(e.message));
    Promise.all([listCrew("drivers"), listCrew("motormates"), listCrew("managers")])
      .then(([d, m, mn]) =>
        setCrew({
          drivers: { total: d.length, free: d.filter((x) => !x.truckPlate).length },
          motormates: { total: m.length, free: m.filter((x) => !x.driverName).length },
          managers: { total: mn.length }
        })
      )
      .catch(() => {});
  }, [kind]);
  useEffect(refresh, [refresh]);

  const shown = useMemo(() => {
    const val = (p: CrewRow, k: string) => String(p[k as keyof CrewRow] ?? "");
    const list = people.filter((p) => {
      if (!`${p.name} ${p.phone}`.toLowerCase().includes(search.toLowerCase())) return false;
      return cols.every((c) => {
        const f = filters[c.key];
        if (!f) return true;
        const v = val(p, c.key);
        return c.link ? (f === "has" ? !!v : !v) : v.toLowerCase().includes(f.toLowerCase());
      });
    });
    if (sort) list.sort((a, b) => val(a, sort.key).localeCompare(val(b, sort.key)) * sort.dir);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, search, filters, sort, kind]);

  async function del(p: CrewRow) {
    if (!confirm(`Delete ${p.name}?`)) return;
    setError("");
    try { await removeCrew(kind, p.id); refresh(); } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white border rounded-xl p-3">
          <p className="text-[10px] uppercase font-bold text-slate-500">Drivers available</p>
          <p className="text-xl font-black">{crew.drivers.free} <span className="text-sm font-semibold text-slate-400">/ {crew.drivers.total}</span></p>
        </div>
        <div className="bg-white border rounded-xl p-3">
          <p className="text-[10px] uppercase font-bold text-slate-500">Motormates available</p>
          <p className="text-xl font-black">{crew.motormates.free} <span className="text-sm font-semibold text-slate-400">/ {crew.motormates.total}</span></p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-slate-500">Managers</p>
          <p className="text-xl font-black">{crew.managers.total}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone…"
          className="flex-grow border rounded-lg px-3 py-1.5 text-sm" />
        <button onClick={() => setModal({ person: null })} className="bg-blue-600 text-white text-sm px-3 rounded-lg whitespace-nowrap">
          + Add {one}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {Object.values(filters).some(Boolean) && (
        <button onClick={() => setFilters({})} className="text-xs text-blue-600 font-semibold">Clear filters</button>
      )}

      <div className="bg-white border rounded-2xl overflow-x-auto min-h-[16rem]">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              {cols.map((c) => (
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
                      {c.link ? (
                        <div className="space-y-1 text-xs">
                          {[["", "All"], ["has", "Has one"], ["none", "None"]].map(([v, t]) => (
                            <label key={v} className="flex items-center gap-2">
                              <input type="radio" checked={(filters[c.key] ?? "") === v}
                                onChange={() => { setFilters({ ...filters, [c.key]: v }); setOpenCol(null); }} />
                              {t}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <input autoFocus value={filters[c.key] ?? ""} placeholder={`Filter ${c.label.toLowerCase()}…`}
                          onChange={(e) => setFilters({ ...filters, [c.key]: e.target.value })}
                          className="w-full border rounded px-2 py-1 text-xs" />
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
              <tr><td colSpan={cols.length + 1} className="p-6 text-center text-slate-400">No {many.toLowerCase()} found.</td></tr>
            )}
            {shown.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3 font-bold">{p.name}</td>
                <td className="p-3 text-slate-600">{p.phone || "—"}</td>
                {kind === "drivers" ? (
                  <>
                    <td className="p-3">{p.truckPlate || <span className="text-slate-400">none</span>}</td>
                    <td className="p-3">{p.motormateName || <span className="text-slate-400">none</span>}</td>
                  </>
                ) : kind === "motormates" ? (
                  <td className="p-3">{p.driverName || <span className="text-slate-400">none</span>}</td>
                ) : null}
                <td className="p-3 text-xs whitespace-nowrap text-right space-x-3">
                  <button onClick={() => setModal({ person: p })} className="text-slate-700 font-semibold">Edit</button>
                  <button onClick={() => del(p)} className="text-red-500">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <CrewFormModal
          key={modal.person?.id ?? "new"}
          kind={kind}
          person={modal.person}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}