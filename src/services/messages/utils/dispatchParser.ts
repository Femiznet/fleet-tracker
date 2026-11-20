/**
 * dispatchParser.ts
 * isDispatchDetails(text)    -> true / false
 * parseDispatchDetails(text) -> { status, data, warnings }  (call only when isDispatchDetails is true)
 */
import { z } from "zod";

export const DispatchDetailsSchema = z.object({
  truckNumber: z.string().nullable(),
  skidNumber: z.string().nullable(),
  driverName: z.string().nullable(),
  customerName: z.string().nullable(), // exactly as written, e.g. "sumal"
  dateOut: z.string().nullable(),      // "2026-11-20"
  timeOut: z.string().nullable(),      // "21:56" (24h)
  driverContact: z.string().nullable(),
});
export type DispatchDetails = z.infer<typeof DispatchDetailsSchema>;

export interface DispatchParseResult {
  status: "ok" | "needs_review";
  data: DispatchDetails;
  warnings: string[];
}
export interface DispatchParseOptions {
  /** when the message arrived; used to catch a mistyped date */
  receivedAt?: Date | null;
}

// ---------------------------------------------------------------- labels
const LABELS: [string, string][] = [
  ["truckNumber", String.raw`truck\s*(?:number|no\b\.?)`],
  ["skidNumber", String.raw`skid\s*(?:number|no\b\.?)`],
  ["driverName", String.raw`driver\s*name`],
  ["customerName", String.raw`customer(?:\s*name)?`],
  ["timeOut", String.raw`time\s*out`],
  ["dateOut", String.raw`date\s*out`],
  ["driverContact", String.raw`driver\s*(?:contact|phone)`],
];
const LABEL_NAMES = LABELS.map(([n]) => n);
const LABEL_RE = new RegExp(LABELS.map(([n, p]) => `(?<${n}>${p})`).join("|"), "gi");

/** cut the message at every label; text between two labels is the value */
function extractFields(text: string): Record<string, string> {
  const flat = text.replace(/\s+/g, " ");
  const hits = [...flat.matchAll(LABEL_RE)].map((m) => ({
    name: LABEL_NAMES.find((n) => m.groups?.[n] !== undefined)!,
    start: m.index!,
    end: m.index! + m[0].length,
  }));
  const fields: Record<string, string> = {};
  hits.forEach((h, i) => {
    const next = i + 1 < hits.length ? hits[i + 1].start : flat.length;
    const value = flat.slice(h.end, next).replace(/^[ :;,\-=*]+|[ :;,\-=*]+$/g, "");
    if (!(h.name in fields)) fields[h.name] = value;
  });
  return fields;
}

// ---------------------------------------------------------------- field readers
const tidy = (v?: string) => {
  const t = v?.replace(/\s+/g, " ").trim();
  return t ? t : null;
};

function readTruck(v?: string): string | null {
  const t = tidy(v)?.replace(/\s+/g, "").toUpperCase();
  return t && /^[A-Z0-9-]{3,12}$/.test(t) && /\d/.test(t) ? t : null;
}

function readSkid(v?: string): { id: string | null; many: boolean } {
  const found = tidy(v)?.match(/(?:[A-Za-z]{2,}\s*)?\d{3,}/g) ?? [];
  const ids = found.map((s) => s.replace(/\s+/g, "").toUpperCase());
  return { id: ids[0] ?? null, many: ids.length > 1 };
}

/** dd/mm/yyyy -> yyyy-mm-dd, or null if it isn't a real date */
function readDate(v?: string): string | null {
  const m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(tidy(v) ?? "");
  if (!m) return null;
  const [d, mo, y] = [+m[1], +m[2], +m[3]];
  if (y < 2020 || y > 2099) return null; // catches typos like 3026
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "9:56Pm" -> "21:56". Returns null when it can't be read for sure ("10:48m", "10:48"). */
function readTime(v?: string): string | null {
  const m = /^(\d{1,2})[:.](\d{2})\s*(?:([ap])\.?m\.?)?$/i.exec(tidy(v) ?? "");
  if (!m) return null;
  let h = +m[1];
  const min = +m[2];
  const ap = m[3]?.toLowerCase();
  if (min > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (ap === "p" ? 12 : 0);
  } else if (h >= 1 && h <= 12) {
    return null; // no am/pm, so we can't tell
  } else if (h > 23) {
    return null;
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function readContact(v?: string): string | null {
  const digits = (tidy(v) ?? "").replace(/[^\d+]/g, "");
  return /^\+?\d{7,15}$/.test(digits) ? digits : null;
}

// ---------------------------------------------------------------- step 1
/** Is this message a dispatch-details report? */
export function isDispatchDetails(text: string): boolean {
  return /dispatch\s*details/i.test(text) && /(?:truck|skid)\s*number/i.test(text);
}

// ---------------------------------------------------------------- step 2
export function parseDispatchDetails(text: string, opts: DispatchParseOptions = {}): DispatchParseResult {
  const f = extractFields(text);
  const skid = readSkid(f.skidNumber);

  const data = DispatchDetailsSchema.parse({
    truckNumber: readTruck(f.truckNumber),
    skidNumber: skid.id,
    driverName: tidy(f.driverName),
    customerName: tidy(f.customerName),
    dateOut: readDate(f.dateOut),
    timeOut: readTime(f.timeOut),
    driverContact: readContact(f.driverContact),
  });

  const w: string[] = [];
  const need = (key: keyof DispatchDetails) => {
    if (data[key] === null) w.push(`missing_${key}`);
  };
  (["truckNumber", "skidNumber", "driverName", "customerName"] as const).forEach(need);

  // dates/times: say whether it was missing or written but unreadable
  if (data.dateOut === null) w.push(tidy(f.dateOut) ? "invalid_dateOut" : "missing_dateOut");
  if (data.timeOut === null) w.push(tidy(f.timeOut) ? "unreadable_timeOut" : "missing_timeOut");
  if (tidy(f.driverContact) && data.driverContact === null) w.push("invalid_driverContact");
  if (skid.many) w.push("multiple_skidNumbers");

  // a mistyped date is common: flag one that is far from when the message arrived
  if (data.dateOut && opts.receivedAt) {
    const days = Math.abs(Date.parse(`${data.dateOut}T00:00:00Z`) - opts.receivedAt.getTime()) / 86_400_000;
    if (days > 3) w.push("date_far_from_received");
  }

  return { status: w.length ? "needs_review" : "ok", data, warnings: w };
}