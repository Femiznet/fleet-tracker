"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
}> = {
  critical: {
    edge: "border-l-4 border-[var(--critical)]",
    badge: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset bg-[var(--critical)/10] text-[var(--critical)]",
    dot: "bg-[var(--critical)]",
    textClass: "text-[var(--muted)]"
  },
  send_now: {
    edge: "border-l-4 border-[var(--warning)]",
    badge: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset bg-[var(--warning)/10] text-[var(--warning)]",
    dot: "bg-[var(--warning)]",
    textClass: "text-[var(--muted)]"
  },
  soon: {
    edge: "border-l-4 border-[var(--muted)]",
    badge: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset bg-[var(--muted)/10] text-[var(--muted)]",
    dot: "bg-[var(--muted)]",
    textClass: "text-[var(--muted)]"
  },
  ok: {
    edge: "border-l-4 border-[var(--success)]",
    badge: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset bg-[var(--success)/10] text-[var(--success)]",
    dot: "bg-[var(--success)]",
    textClass: "text-[var(--muted)]"
  },
  unknown: {
    edge: "border-l-4 border-[var(--neutral)]",
    badge: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset bg-[var(--neutral)/10] text-[var(--neutral)]",
    dot: "bg-[var(--neutral)]",
    textClass: "text-[var(--muted)]"
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

function getTextClass(status: Status) {
  return STATUS_CLASSES[status].textClass
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

export default function StatusBoard({ statuses, generatedAt, alertsOn }: { statuses: CustomerStatus[]; generatedAt: string; alertsOn: boolean }) {
  const now = new Date()

  const shown = statuses.filter(
    (c) => c.status !== "unknown" && (c.flags.length === 0 || !c.flags.some((f) => f.includes("no update")))
  )

  return (
    <div className="space-y-4">
      <AlertBanner statuses={statuses} enabled={alertsOn} />
      {shown.length > 0 ? (
        <table className="w-full caption-bottom text-sm">
          <thead>
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
          <tbody className="divide-y divide-[var(--border)]">
            {shown.map((c) => (
              <tr key={c.name} className="align-top">
                <td className={STATUS_CLASSES[c.status].edge}>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-[var(--muted)]">{updatedText(c, now)}</div>
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
                <td className="px-4 py-3 tabular-nums">
                  {c.pressureBar === null ? "–" : (
                    <>
                      {c.pressureBar} <span className="text-[var(--muted)]">bar</span>
                    </>
                  )}
                </td>
                <td className="px-4 py-3"><Flow c={c} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <li key={c.name} className="rounded-lg border border-l-4 border-[var(--border)] bg-[var(--card)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{c.name}</h2>
                  <p className="text-xs text-[var(--muted)]">{updatedText(c, now)}</p>
                </div>
                <Badge status={c.status} />
              </div>

              <div className="mt-4">
                <p className="text-xs text-[var(--muted)]">Send skid by</p>
                <div className="text-2xl"><When iso={c.sendBy} now={now} overdue /></div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-[var(--muted)]">Skid empty</dt>
                  <dd><When iso={c.runOutAt} now={now} /></dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">All skids empty</dt>
                  <dd><When iso={c.shutdownAt} now={now} /></dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Pressure</dt>
                  <dd className="tabular-nums">
                    {c.pressureBar === null ? "–" : `${c.pressureBar} bar`}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Flow</dt>
                  <dd><Flow c={c} /></dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}