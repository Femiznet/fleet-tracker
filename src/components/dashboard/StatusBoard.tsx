"use client"

import AlertBanner from "./AlertBanner"
import type { CustomerStatus, Status } from "@/lib/calc/monitor"

const TZ = "Africa/Lagos"

const hm = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TZ,
})
const dayName = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: TZ })
const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ })

function clock(iso: string, now: Date) {
  const d = new Date(iso)
  const time = hm.format(d)
  return dateKey.format(d) === dateKey.format(now) ? time : `${dayName.format(d)} ${time}`
}

function span(ms: number) {
  const m = Math.max(1, Math.round(ms / 60000))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 48) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`
  return `${Math.round(h / 24)} days`
}

// Predefine class names to avoid template literal parsing issues
const STATUS_CLASSES: Record<Status, {
  edge: string
  badge: string
  dot: string
  textClass: string
  label: string
}> = {
  critical: {
    edge: "border-l-4 border-[var(--critical)]",
    badge: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset bg-[var(--critical)/10] text-[var(--critical)]",
    dot: "bg-[var(--critical)]",
    textClass: "text-[var(--muted)]",
    label: "Critical"
  },
  send_now: {
    edge: "border-l-4 border-[var(--warning)]",
    badge: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset bg-[var(--warning)/10] text-[var(--warning)]",
    dot: "bg-[var(--warning)]",
    textClass: "text-[var(--muted)]",
    label: "Send Now"
  },
  soon: {
    edge: "border-l-4 border-[var(--muted)]",
    badge: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset bg-[var(--muted)/10] text-[var(--muted)]",
    dot: "bg-[var(--muted)]",
    textClass: "text-[var(--muted)]",
    label: "Soon"
  },
  ok: {
    edge: "border-l-4 border-[var(--success)]",
    badge: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset bg-[var(--success)/10] text-[var(--success)]",
    dot: "bg-[var(--success)]",
    textClass: "text-[var(--muted)]",
    label: "OK"
  },
  unknown: {
    edge: "border-l-4 border-[var(--neutral)]",
    badge: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset bg-[var(--neutral)/10] text-[var(--neutral)]",
    dot: "bg-[var(--neutral)]",
    textClass: "text-[var(--muted)]",
    label: "Unknown"
  },
}

function Badge({ status }: { status: Status }) {
  const s = STATUS_CLASSES[status]
  return (
    <span className={s.badge}>
      <span className={s.dot} aria-hidden />
      {s.label}
    </span>
  )
}

function When({ iso, now, overdue }: { iso: string | null; now: Date; overdue?: boolean }) {
  if (!iso) return <span className="text-[var(--muted)]">No end in sight</span>
  const diff = new Date(iso).getTime() - now.getTime()
  const late = diff < 0
  const rel = late ? (overdue ? `${span(-diff)} overdue` : `${span(-diff)} ago`) : `in ${span(diff)}`
  return (
    <div>
      <div className="font-medium tabular-nums">{clock(iso, now)}</div>
      <div className={late && overdue ? "font-medium text-[var(--critical)]" : "text-[var(--muted)]"}>{rel}</div>
    </div>
  )
}

function Delta({ label, v }: { label: string; v: number | null }) {
  if (v === null) return null
  const sign = v > 0 ? "+" : v < 0 ? "−" : ""
  return (
    <span className={Math.abs(v) >= 20 ? "font-medium text-[var(--warning)]" : "text-[var(--muted)]"}>
      {label} {sign}
      {Math.abs(v)}%
    </span>
  )
}

function Flow({ c }: { c: CustomerStatus }) {
  if (c.flowRate === null) return <span className="text-[var(--muted)]">–</span>
  return (
    <div>
      <div className="tabular-nums">
        {c.flowRate} <span className="text-[var(--muted)]">scm/h</span>
      </div>
      <div className="flex gap-3 text-xs tabular-nums">
        <Delta label="hour" v={c.flowChangeHourlyPct} />
        <Delta label="day" v={c.flowChangeDailyPct} />
      </div>
    </div>
  )
}

function updatedText(c: CustomerStatus, now: Date) {
  if (!c.lastUpdateAt) return "No update yet"
  const diff = now.getTime() - new Date(c.lastUpdateAt).getTime()
  return diff < 60000 ? "Updated just now" : `Updated ${Math.round(diff / 60000)} min ago`
}

export default function StatusBoard({ statuses, alertsOn }: { statuses: CustomerStatus[]; alertsOn: boolean }) {
  const now = new Date()

  const shown = statuses.filter(
    (c) => c.status !== "unknown" && (c.flags.length === 0 || !c.flags.some((f) => f.includes("no update")))
  )

  return (
    <div className="space-y-5">
      <AlertBanner statuses={statuses} enabled={alertsOn} />
      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] px-5 py-12 text-center sm:px-8">
          <p className="font-medium text-[var(--fg)]">No customer alerts to show</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Customers without a recent usable update are hidden until new data arrives.
          </p>
        </div>
      ) : (
        <>
          <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
          {shown.map((c) => (
            <li key={c.name} className={`rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5 ${STATUS_CLASSES[c.status].edge}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words font-semibold text-[var(--fg)]">{c.name}</h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">{updatedText(c, now)}</p>
                </div>
                <Badge status={c.status} />
              </div>

              {c.flags.length > 0 && (
                <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                  {c.flags.slice(0, 2).join("; ")}
                  {c.flags.length > 2 ? `; +${c.flags.length - 2} more` : ""}
                </p>
              )}

              <div className="mt-4 rounded-xl bg-[var(--bg)] p-3">
                <p className="text-xs text-[var(--muted)]">Send skid by</p>
                <div className="mt-1 text-lg font-semibold"><When iso={c.sendBy} now={now} overdue /></div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
                <div className="min-w-0">
                  <dt className="text-xs text-[var(--muted)]">Skid empty</dt>
                  <dd className="mt-1"><When iso={c.runOutAt} now={now} /></dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-[var(--muted)]">All skids empty</dt>
                  <dd className="mt-1"><When iso={c.shutdownAt} now={now} /></dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Pressure</dt>
                  <dd className="mt-1 font-medium tabular-nums">{c.pressureBar === null ? "–" : `${c.pressureBar} bar`}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-[var(--muted)]">Flow</dt>
                  <dd className="mt-1"><Flow c={c} /></dd>
                </div>
              </dl>
            </li>
          ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm lg:block">
            <table className="w-full min-w-[980px] caption-bottom text-left text-sm">
              <thead className="bg-[var(--bg)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th scope="col" className="px-4 py-3">Customer</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Send skid by</th>
                  <th scope="col" className="px-4 py-3">Skid empty</th>
                  <th scope="col" className="px-4 py-3">All skids empty</th>
                  <th scope="col" className="px-4 py-3">Pressure</th>
                  <th scope="col" className="px-4 py-3">Flow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {shown.map((c) => (
                  <tr key={c.name} className="align-top">
                    <td className={`px-4 py-3 ${STATUS_CLASSES[c.status].edge}`}>
                      <div className="font-medium">{c.name}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">{updatedText(c, now)}</div>
                      {c.flags.length > 0 && (
                        <div className="mt-1 max-w-xs text-xs text-[var(--muted)]" title={c.flags.join("; ")}>
                          {c.flags.slice(0, 2).join("; ")}
                          {c.flags.length > 2 ? `; +${c.flags.length - 2} more` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3"><Badge status={c.status} /></td>
                    <td className="px-4 py-3"><When iso={c.sendBy} now={now} overdue /></td>
                    <td className="px-4 py-3"><When iso={c.runOutAt} now={now} /></td>
                    <td className="px-4 py-3"><When iso={c.shutdownAt} now={now} /></td>
                    <td className="px-4 py-3 tabular-nums">{c.pressureBar === null ? "–" : `${c.pressureBar} bar`}</td>
                    <td className="px-4 py-3"><Flow c={c} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}