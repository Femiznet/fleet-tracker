"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerStatus, Status } from "@/lib/calc/monitor";

const TZ = "Africa/Lagos";

const hm = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TZ,
});
const dayName = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: TZ });
const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });

function clock(iso: string, now: Date) {
  const d = new Date(iso);
  const time = hm.format(d);
  return dateKey.format(d) === dateKey.format(now) ? time : `${dayName.format(d)} ${time}`;
}

function span(ms: number) {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  return `${Math.round(h / 24)} days`;
}

const STYLE: Record<Status, { label: string; edge: string; badge: string; dot: string }> = {
  critical: { label: "Critical", edge: "border-red-600", badge: "bg-red-50 text-red-800 ring-red-200", dot: "bg-red-600" },
  send_now: { label: "Send now", edge: "border-orange-500", badge: "bg-orange-50 text-orange-800 ring-orange-200", dot: "bg-orange-500" },
  soon: { label: "Send soon", edge: "border-amber-400", badge: "bg-amber-50 text-amber-900 ring-amber-200", dot: "bg-amber-400" },
  ok: { label: "On track", edge: "border-emerald-600", badge: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-600" },
  unknown: { label: "No data", edge: "border-slate-400", badge: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
};

function Badge({ status }: { status: Status }) {
  const s = STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${s.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}

function When({ iso, now, overdue }: { iso: string | null; now: Date; overdue?: boolean }) {
  if (!iso) return <span className="text-slate-400">No end in sight</span>;
  const diff = new Date(iso).getTime() - now.getTime();
  const late = diff < 0;
  const rel = late ? (overdue ? `${span(-diff)} overdue` : `${span(-diff)} ago`) : `in ${span(diff)}`;
  return (
    <div>
      <div className="font-medium tabular-nums">{clock(iso, now)}</div>
      <div className={`text-xs ${late && overdue ? "font-medium text-red-700" : "text-slate-500"}`}>{rel}</div>
    </div>
  );
}

function Delta({ label, v }: { label: string; v: number | null }) {
  if (v === null) return null;
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return (
    <span className={Math.abs(v) >= 20 ? "font-medium text-orange-700" : "text-slate-500"}>
      {label} {sign}
      {Math.abs(v)}%
    </span>
  );
}

function Flow({ c }: { c: CustomerStatus }) {
  if (c.flowRate === null) return <span className="text-slate-400">–</span>;
  return (
    <div>
      <div className="tabular-nums">
        {c.flowRate} <span className="text-slate-500">scm/h</span>
      </div>
      <div className="flex gap-3 text-xs tabular-nums">
        <Delta label="hour" v={c.flowChangeHourlyPct} />
        <Delta label="day" v={c.flowChangeDailyPct} />
      </div>
    </div>
  );
}

function updatedText(c: CustomerStatus, now: Date) {
  if (!c.lastUpdateAt) return "No update yet";
  const diff = now.getTime() - new Date(c.lastUpdateAt).getTime();
  return diff < 60000 ? "Updated just now" : `Updated ${span(diff)} ago`;
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
            value === o.value ? "bg-slate-900 text-white" : "text-slate-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function StatusBoard({
  statuses,
  generatedAt,
}: {
  statuses: CustomerStatus[];
  generatedAt: string;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date(generatedAt));
  const [view, setView] = useState<"table" | "cards">(() => {
    try {
      const saved = localStorage.getItem("monitor-view");
      if (saved === "table" || saved === "cards") return saved;
    } catch {}
    return typeof window !== "undefined" && window.innerWidth < 768 ? "cards" : "table";
  });
  const [filter, setFilter] = useState<"all" | "action">("all");

  // view initialized lazily above; no effect needed

  // now is initialized from generatedAt and refreshed by the interval below
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);

  function changeView(v: "table" | "cards") {
    setView(v);
    try {
      localStorage.setItem("monitor-view", v);
    } catch {}
  }

  const needsAction = statuses.filter((s) => ["critical", "send_now", "soon"].includes(s.status));
  const shown = filter === "action" ? needsAction : statuses;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 bg-[var(--bg)] text-[var(--fg)]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Customer monitor</h1>
          <p className="mt-1 text-sm text-slate-600">
            {statuses.length} customers, {needsAction.length} need a skid soon. Last refreshed {hm.format(now)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Segmented
            label="Filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All (${statuses.length})` },
              { value: "action", label: `Needs action (${needsAction.length})` },
            ]}
          />
          <Segmented
            label="View"
            value={view}
            onChange={changeView}
            options={[
              { value: "table", label: "Table" },
              { value: "cards", label: "Cards" },
            ]}
          />
        </div>
      </header>

      {shown.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-600">
          {statuses.length === 0
            ? "No customers yet. Add rows to the customers table and their updates will show here."
            : "Nothing needs a skid right now."}
        </p>
      ) : view === "table" ? (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Send skid by</th>
                <th className="px-4 py-3">Skid empty</th>
                <th className="px-4 py-3">All skids empty</th>
                <th className="px-4 py-3">Pressure</th>
                <th className="px-4 py-3">Flow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((c) => (
                <tr key={c.name} className="align-top">
                  <td className={`border-l-4 px-4 py-3 ${STYLE[c.status].edge}`}>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-slate-500">{updatedText(c, now)}</div>
                    {c.flags.length > 0 && (
                      <div className="mt-1 max-w-xs text-xs text-slate-700" title={c.flags.join("; ")}>
                        {c.flags.slice(0, 2).join("; ")}
                        {c.flags.length > 2 ? `; +${c.flags.length - 2} more` : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3"><Badge status={c.status} /></td>
                  <td className="px-4 py-3"><When iso={c.sendBy} now={now} overdue /></td>
                  <td className="px-4 py-3"><When iso={c.runOutAt} now={now} /></td>
                  <td className="px-4 py-3"><When iso={c.shutdownAt} now={now} /></td>
                  <td className="px-4 py-3 tabular-nums">
                    {c.pressureBar === null ? "–" : <>{c.pressureBar} <span className="text-slate-500">bar</span></>}
                  </td>
                  <td className="px-4 py-3"><Flow c={c} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <li key={c.name} className={`rounded-lg border border-l-4 border-slate-200 bg-white p-4 ${STYLE[c.status].edge}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{c.name}</h2>
                  <p className="text-xs text-slate-500">{updatedText(c, now)}</p>
                </div>
                <Badge status={c.status} />
              </div>

              <div className="mt-4">
                <p className="text-xs text-slate-500">Send skid by</p>
                <div className="text-2xl"><When iso={c.sendBy} now={now} overdue /></div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div><dt className="text-xs text-slate-500">Skid empty</dt><dd><When iso={c.runOutAt} now={now} /></dd></div>
                <div><dt className="text-xs text-slate-500">All skids empty</dt><dd><When iso={c.shutdownAt} now={now} /></dd></div>
                <div>
                  <dt className="text-xs text-slate-500">Pressure</dt>
                  <dd className="tabular-nums">{c.pressureBar === null ? "–" : `${c.pressureBar} bar`}</dd>
                </div>
                <div><dt className="text-xs text-slate-500">Flow</dt><dd><Flow c={c} /></dd></div>
              </dl>

              {c.flags.length > 0 && (
                <ul className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-700">
                  {c.flags.map((f) => <li key={f}>{f}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}