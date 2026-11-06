import type { Extraction } from "../ai/extractionSchema";

export const SCM_PER_BAR = 28; // 7000 scm / 250 bar
export const PREP_MIN = 30; // waybill + driver prep
export const BUFFER_MIN = 60; // safety buffer
export const STALE_MIN = 90; // updates are hourly; older than this = late
const MIN = 60_000;

export type UpdateRow = { id: string; received_at: string; data: Extraction };

export type CustomerSettings = {
  name: string;
  cutoff_bar: number;
  trip_minutes: number | null;
  full_bar: number;
};

export type Status = "critical" | "send_now" | "soon" | "ok" | "unknown";

export type CustomerStatus = {
  name: string;
  status: Status;
  flags: string[];
  lastUpdateAt: string | null;
  pressureBar: number | null;
  flowRate: number | null;
  runOutAt: string | null; // when the skid in use hits cutoff
  sendBy: string | null; // when the next skid must leave the plant
  shutdownAt: string | null; // when ALL skids on site are used up
  flowChangeHourlyPct: number | null;
  flowChangeDailyPct: number | null;
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const iso = (ms: number) => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);

// Rows must be newest first. Keeps the first copy of repeated messages.
export function dedupe(rowsNewestFirst: UpdateRow[]): UpdateRow[] {
  const seen = new Set<string>();
  const kept: UpdateRow[] = [];
  for (const r of [...rowsNewestFirst].reverse()) {
    const d = r.data;
    const slot = Math.floor(Date.parse(r.received_at) / (10 * MIN));
    const key = isNum(d.meter_reading_scm)
      ? `m|${d.meter_reading_scm}|${d.current_pressure_bar}`
      : `t|${slot}|${d.current_pressure_bar}|${d.flow_rate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(r);
  }
  return kept.reverse();
}

function nearest(rows: UpdateRow[], targetMs: number, tolMs: number): UpdateRow | null {
  let best: UpdateRow | null = null;
  let bestD = Infinity;
  for (const r of rows) {
    const d = Math.abs(Date.parse(r.received_at) - targetMs);
    if (d <= tolMs && d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
}

const pct = (cur: number, old: number) =>
  old > 0 ? Math.round(((cur - old) / old) * 1000) / 10 : null;

const idKey = (ids: string[] | null | undefined) =>
  Array.isArray(ids) && ids.length ? [...ids].sort().join(",") : null;

export function computeStatus(
  customer: CustomerSettings,
  rowsNewestFirst: UpdateRow[],
  now: Date = new Date()
): CustomerStatus {
  const flags: string[] = [];
  const empty: CustomerStatus = {
    name: customer.name,
    status: "unknown",
    flags,
    lastUpdateAt: null,
    pressureBar: null,
    flowRate: null,
    runOutAt: null,
    sendBy: null,
    shutdownAt: null,
    flowChangeHourlyPct: null,
    flowChangeDailyPct: null,
  };

  const rows = dedupe(rowsNewestFirst).filter(
    (r) => isNum(r.data.current_pressure_bar) && isNum(r.data.flow_rate)
  );
  const latest = rows[0];
  if (!latest) {
    flags.push("no usable update");
    return empty;
  }

  const t = Date.parse(latest.received_at);
  const P = latest.data.current_pressure_bar as number;
  const flow = latest.data.flow_rate as number;
  const ageMin = (now.getTime() - t) / MIN;

  if (ageMin > STALE_MIN) flags.push(`no update for ${Math.round(ageMin)} min`);

  const trip = customer.trip_minutes ?? 0;
  if (customer.trip_minutes === null) flags.push("trip time unknown");

  const standby = latest.data.standby_skids;
  if (!isNum(standby)) flags.push("standby count missing, assumed 0");
  const sb = isNum(standby) ? standby : 0;

  // Main (dispatch) timer: the skid in use.
  const usable = Math.max(0, P - customer.cutoff_bar);
  const skidHours = flow > 0 ? (usable * SCM_PER_BAR) / flow : Infinity;
  const runOutMs = t + skidHours * 60 * MIN;
  const sendByMs = runOutMs - (trip + PREP_MIN + BUFFER_MIN) * MIN;

  // Critical (shutdown) timer: skid in use + every standby skid.
  const standbyUsable = sb * Math.max(0, customer.full_bar - customer.cutoff_bar);
  const shutdownHours = flow > 0 ? ((usable + standbyUsable) * SCM_PER_BAR) / flow : Infinity;
  const shutdownMs = t + shutdownHours * 60 * MIN;
  const criticalMs = shutdownMs - (trip + PREP_MIN) * MIN;

  if (flow === 0) flags.push("zero flow reported");

  // Swap detection (skid IDs changed, or pressure rose).
  const prev = rows[1];
  if (prev) {
    const a = idKey(prev.data.skid_in_use_numbers);
    const b = idKey(latest.data.skid_in_use_numbers);
    const pPrev = prev.data.current_pressure_bar as number;
    if ((a && b && a !== b) || P > pPrev + 5) flags.push("skid swap since last update");
  }

  // Flow change: hourly and daily.
  const older = rows.slice(1);
  const hourAgo = nearest(older, t - 60 * MIN, 25 * MIN);
  const dayAgo = nearest(older, t - 24 * 60 * MIN, 60 * MIN);
  const hourly = hourAgo ? pct(flow, hourAgo.data.flow_rate as number) : null;
  const daily = dayAgo ? pct(flow, dayAgo.data.flow_rate as number) : null;
  if (hourly !== null && Math.abs(hourly) >= 20) flags.push(`flow changed ${hourly}% in the last hour`);

  // Cross-check reported flow against the meter reading.
  const m = latest.data.meter_reading_scm;
  const prevM = older.find((r) => isNum(r.data.meter_reading_scm));
  if (isNum(m) && prevM) {
    const pm = prevM.data.meter_reading_scm as number;
    const hours = (t - Date.parse(prevM.received_at)) / (60 * MIN);
    if (m < pm) flags.push("meter reading went backwards");
    else if (hours >= 0.25 && hours <= 3) {
      const measured = (m - pm) / hours;
      if (flow > 0 && Math.abs(measured - flow) / flow > 0.15)
        flags.push(`reported flow ${flow} vs meter-derived ${Math.round(measured)} scm/h`);
      if (hours > 1.5) flags.push(`updates ${hours.toFixed(1)} h apart`);
    }
  }

  const nowMs = now.getTime();
  let status: Status = "ok";
  if (nowMs >= criticalMs) status = "critical";
  else if (nowMs >= sendByMs) status = "send_now";
  else if (sendByMs - nowMs <= 60 * MIN) status = "soon";

  return {
    name: customer.name,
    status,
    flags,
    lastUpdateAt: latest.received_at,
    pressureBar: P,
    flowRate: flow,
    runOutAt: iso(runOutMs),
    sendBy: iso(sendByMs),
    shutdownAt: iso(shutdownMs),
    flowChangeHourlyPct: hourly,
    flowChangeDailyPct: daily,
  };
}