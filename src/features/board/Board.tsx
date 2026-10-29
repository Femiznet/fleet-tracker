"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listTrucks } from "@/features/trucks/service";
import { listSkids } from "@/features/skids/service";
import { setStatus, type TrackStatus } from "@/features/tracker/service";

type Row = { id: string; name: string; status?: TrackStatus | null; location?: string | null };

const TRUCK_STATUSES: TrackStatus[] = ["online", "maintenance"];
const SKID_STATUSES: TrackStatus[] = ["empty", "loaded", "maintenance"];

const badge: Record<string, string> = {
  online: "bg-violet-100 text-violet-800",
  in_transit: "bg-orange-100 text-orange-800",
  empty: "bg-amber-100 text-amber-800",
  loaded: "bg-emerald-100 text-emerald-800",
  maintenance: "bg-rose-100 text-rose-800",
};

export function Board() {
  const [trucks, setTrucks] = useState<Row[]>([]);
  const [skids, setSkids] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([listTrucks(), listSkids()]);
      setTrucks(t.map((x) => ({ id: x.id, name: x.plate, status: x.status as TrackStatus, location: x.location })));
      setSkids(s.map((x) => ({ id: x.id, name: x.skidNo, status: x.status as TrackStatus, location: x.location })));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const match = (r: Row) =>
    `${r.name} ${r.location ?? ""}`.toLowerCase().includes(search.toLowerCase()) &&
    (filter === "all" || r.status === filter);

  const fTrucks = useMemo(() => trucks.filter(match), [trucks, search, filter]);
  const fSkids = useMemo(() => skids.filter(match), [skids, search, filter]);

  const count = (rows: Row[], s: string) => rows.filter((r) => r.status === s).length;

  async function change(kind: "truck" | "skid", id: string, status: TrackStatus) {
    setError("");
    try {
      await setStatus(kind, id, status);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <Tile label="Trucks" value={trucks.length} />
        <Tile label="Skids" value={skids.length} />
        <Tile label="In transit" value={count(trucks, "in_transit") + count(skids, "in_transit")} />
        <Tile label="Maintenance" value={count(trucks, "maintenance") + count(skids, "maintenance")} />
      </div>

      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search plate, skid, location…"
          className="flex-grow border rounded-lg px-3 py-1.5 text-sm"
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border rounded-lg px-2 text-sm">
          <option value="all">All status</option>
          {Object.keys(badge).map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <button onClick={refresh} className="border rounded-lg px-3 text-sm">Refresh</button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Section title="Trucks" rows={fTrucks} options={TRUCK_STATUSES} onChange={(id, s) => change("truck", id, s)} />
      <Section title="Skids" rows={fSkids} options={SKID_STATUSES} onChange={(id, s) => change("skid", id, s)} />
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

function Section({
  title, rows, options, onChange,
}: {
  title: string;
  rows: Row[];
  options: TrackStatus[];
  onChange: (id: string, s: TrackStatus) => void;
}) {
  return (
    <section className="bg-white rounded-2xl border p-4">
      <h2 className="font-bold mb-2">{title} <span className="text-slate-400 text-sm">({rows.length})</span></h2>
      {!rows.length && <p className="text-sm text-slate-400">Nothing matches.</p>}
      <ul className="divide-y">
        {rows.map((r) => {
          const locked = r.status === "in_transit";
          return (
            <li key={r.id} className="py-2 flex items-center justify-between gap-2 text-sm">
              <span>
                <strong>{r.name}</strong>
                <span className="text-slate-500"> · {r.location ?? "no location"}</span>
              </span>
              {locked ? (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badge.in_transit}`}>in transit</span>
              ) : (
                <select
                  value={r.status ?? ""}
                  onChange={(e) => onChange(r.id, e.target.value as TrackStatus)}
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${badge[r.status ?? ""] ?? ""}`}
                >
                  {/* keep the current value selectable even if it isn't in the manual list */}
                  {r.status && !options.includes(r.status) && <option value={r.status}>{r.status}</option>}
                  {options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}