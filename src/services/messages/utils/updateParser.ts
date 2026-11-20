import { z } from "zod";

/**
 * parseUpdate.ts  -  pure function, no DB, no framework.
 * isUpdate(text)    -> true / false
 * parseUpdate(text)  -> { status, data, warnings }   (call it only when isUpdate is true)
 */

const skids = z.union([z.string(), z.array(z.string())]).nullable();

export const CustomerUpdateMessageSchema = z.object({
  PRMS: z.array(
    z.object({
      id: z.number().int(),
      pressure: z.number().nullable(),
      flowrate: z.number().nullable(),
      totalflow: z.number().nullable(),
      skidinuse: skids,
    })
  ),
  outletpressure: z.number().nullable(),
  standbyskid: skids,
  emptyskid: skids,
  availabletrucks: z.union([z.number().int(), z.array(z.string())]).nullable(),
  reportedAt: z.string().nullish().transform((v) => v ?? null), // time written inside the message, if any
});

export type CustomerUpdateMessage = z.infer<typeof CustomerUpdateMessageSchema>;
export type Skids = z.infer<typeof skids>;

export interface ParseResult {
  status: "ok" | "needs_review";
  data: CustomerUpdateMessage;
  warnings: string[];
}

export interface ParseOptions {
  /** last known totalflow for this station; enables the "meter went down" check */
  previousTotalFlow?: number | null;
}

// ---------------------------------------------------------------- config
const RANGES = {
  pressure: [0, 350],
  flowrate: [0, 5000],
  totalflow: [0, 1e9],
  outletpressure: [0, 60],
} as const;

// Order matters: most specific label first.
const LABELS: [string, string][] = [
  ["outletpressure", String.raw`(?:outlet\w*|final)\s*pressures?`],
  ["outlet_temp", String.raw`outlet\s*tem\w*`],
  ["gas_temp", String.raw`gas\s*temp\w*|temperature`],
  // only counts if a number follows (skips the "PRESSURE UPDATE" title)
  ["pressure", String.raw`(?:skid\s*|inlet\s*)?pressures?(?=\s*[:\-=]?\s*[\(\*]*\s*\d)`],
  ["flowrate", String.raw`flow\s*-?\s*rate(?:\s*\d(?=\s*[:=]))?`],
  ["totalflow", String.raw`total\s*flow(?:\s*\d(?=\s*[:=]))?|total(?=\s*[:(])`],
  ["skidinuse", String.raw`skid\s*in\s*use|in\s*use\s*skid|online\s*skid`],
  ["standbyskid", String.raw`\*?standby(?:\s*skid)?\*?`],
  ["emptyskid", String.raw`empty(?:\s*skid)?`],
  ["returning", String.raw`returning`],
  ["availabletrucks", String.raw`available\s*trucks?|trucks?\s*available`],
  ["landing", String.raw`landing\s*(?:gear)?\s*(?:boxes|box|blocks)?`],
];
const LABEL_NAMES = LABELS.map(([n]) => n);
const LABEL_RE = new RegExp(
  LABELS.map(([n, p]) => `(?<${n}>${p})`).join("|"),
  "gi"
);

const NULL_WORDS = new Set(["", "nil", "nill", "none", "n/a", "na", "-", "no", "nothing"]);
const NUM_RE = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/;

// ---------------------------------------------------------------- helpers
const cleanValue = (v: string) =>
  v.replace(/\*/g, " ").replace(/^[ :;,\-=\n\t]+|[ :;,\-=\n\t]+$/g, "");

const isNull = (v: string) =>
  NULL_WORDS.has(v.replace(/[()\[\].,]/g, "").trim().toLowerCase());

function toNumber(v: string | undefined): number | null {
  if (v === undefined) return null;
  const m = NUM_RE.exec(v);
  return m ? parseFloat(m[0].replace(/,/g, "")) : null;
}

function skidIds(v: string | undefined): string[] {
  if (v === undefined || isNull(v) || /^[\s0()]*$/.test(v)) return [];
  const found = v.match(/(?:[A-Za-z]{2,}\s*)?\d{3,}/g) ?? [];
  return found.map((s) => s.replace(/\s+/g, "").toUpperCase());
}

const oneOrMany = (ids: string[]): Skids =>
  ids.length === 0 ? null : ids.length === 1 ? ids[0] : ids;

function parseTrucks(v: string | undefined): { value: number | string[] | null; warn?: string } {
  if (v === undefined || isNull(v)) return { value: null };
  const inner = v.replace(/[()]/g, " ").trim();
  const first = inner.split(/\s+/)[0]?.toLowerCase() ?? "";
  if (NULL_WORDS.has(first)) return { value: null }; // "Nil <extra text>"
  if (/^\d{1,2}$/.test(inner)) return { value: parseInt(inner, 10) }; // a count
  const plates = inner
    .split(/[,&/\n]|\band\b/i)
    .map((p) => p.replace(/\s+/g, "").toUpperCase())
    .filter(Boolean);
  const looksLikePlates =
    plates.length > 0 && plates.every((p) => /^[A-Z0-9-]{3,12}$/.test(p) && /\d/.test(p));
  return looksLikePlates ? { value: plates } : { value: null, warn: "trucks_unparsed" };
}

function reportedAt(text: string): string | null {
  const d = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(text);
  if (!d) return null;
  const [day, mon, yr] = [+d[1], +d[2], +d[3]];
  let hh = 0, mm = 0;
  const t24 = /@\s*(\d{1,2}):(\d{2})\s*HRS/i.exec(text);
  const t12 = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(text);
  if (t24) { hh = +t24[1]; mm = +t24[2]; }
  else if (t12) { hh = (+t12[1]) % 12 + (t12[3].toUpperCase() === "PM" ? 12 : 0); mm = +t12[2]; }
  if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${yr}-${p(mon)}-${p(day)}T${p(hh)}:${p(mm)}:00`;
}

/** cut the message at every label; text between two labels is the value */
function extractFields(text: string): Record<string, string> {
  const flat = text.replace(/\s+/g, " ");
  const hits: { name: string; start: number; end: number }[] = [];
  for (const m of flat.matchAll(LABEL_RE)) {
    let name = LABEL_NAMES.find((n) => m.groups?.[n] !== undefined)!;
    // "Flow Rate 2:" / "Total Flow2:" -> numbered PRMS reading, stored as "flowrate:2"
    if (name === "flowrate" || name === "totalflow") {
      const idx = /(\d)\s*$/.exec(m[0])?.[1];
      if (idx) name = `${name}:${idx}`;
    }
    hits.push({ name, start: m.index!, end: m.index! + m[0].length });
  }
  const fields: Record<string, string> = {};
  hits.forEach((h, i) => {
    const next = i + 1 < hits.length ? hits[i + 1].start : flat.length;
    if (!(h.name in fields)) fields[h.name] = cleanValue(flat.slice(h.end, next));
  });
  return fields;
}

// ---------------------------------------------------------------- main
const hasField = (f: Record<string, string>, base: string) =>
  Object.keys(f).some((k) => k === base || k.startsWith(`${base}:`));

/** Step 1: is this message a station update at all? */
export function isUpdate(text: string): boolean {
  if (/skid\s*change\s*details/i.test(text)) return false; // a different report type
  const f = extractFields(text);
  // an update has at least two of: pressure, flow rate, total flow
  return ["pressure", "flowrate", "totalflow"].filter((k) => hasField(f, k)).length >= 2;
}

/** Step 2: read the fields out of an update. */
export function parseUpdate(text: string, opts: ParseOptions = {}): ParseResult {
  const f = extractFields(text);

  // PRMS numbers present in the message ("flowrate:1", "totalflow:2" ...). None = single PRMS.
  const indices = [
    ...new Set(
      Object.keys(f)
        .map((k) => /^(?:flowrate|totalflow):(\d)$/.exec(k)?.[1])
        .filter((x): x is string => x !== undefined)
        .map(Number)
    ),
  ].sort((a, b) => a - b);
  const numbered = indices.length > 0;
  const ids = numbered ? indices : [1];

  // skid pressure and the skid in use are shared by every PRMS
  const inUse = skidIds(f.skidinuse);
  const prmsList = ids.map((id) => {
    const sfx = numbered ? `:${id}` : "";
    return {
      id,
      pressure: toNumber(f.pressure),
      flowrate: toNumber(f[`flowrate${sfx}`]),
      totalflow: toNumber(f[`totalflow${sfx}`]),
      skidinuse: oneOrMany(inUse),
    };
  });
  const trucks = parseTrucks(f.availabletrucks);
  const draft = {
    PRMS: prmsList,
    outletpressure: toNumber(f.outletpressure),
    standbyskid: oneOrMany(skidIds(f.standbyskid)),
    emptyskid: oneOrMany(skidIds(f.emptyskid)),
    availabletrucks: trucks.value,
    reportedAt: reportedAt(text),
  };

  // shape guard: throws if we ever build something that isn't the clean format
  const data = CustomerUpdateMessageSchema.parse(draft);

  // ------------------------------------------------------------ validate
  const w: string[] = [];
  if (trucks.warn) w.push(trucks.warn);

  // "0 100Scm/h" style values: two separate numbers, we can't know which one is right
  for (const [k, v] of Object.entries(f)) {
    if (/^(flowrate|totalflow)/.test(k) && /^\d[\d,.]*\s+\d/.test(v)) {
      w.push(`ambiguous_${k.replace(":", "_prms")}`);
    }
  }

  const check = (key: keyof typeof RANGES, val: number | null, required: boolean, sfx = "") => {
    if (val === null) { if (required) w.push(`missing_${key}${sfx}`); return; }
    const [lo, hi] = RANGES[key];
    if (val < lo || val > hi) w.push(`out_of_range_${key}${sfx}=${val}`);
  };
  for (const p of prmsList) {
    const sfx = numbered ? `_prms${p.id}` : "";
    check("pressure", p.pressure, true, sfx);
    check("flowrate", p.flowrate, true, sfx);
    check("totalflow", p.totalflow, true, sfx);
  }
  check("outletpressure", data.outletpressure, false);

  const idle = prmsList.every((p) => p.flowrate === 0 && p.pressure === 0);
  if (inUse.length === 0 && !idle) w.push("missing_skidinuse");

  const standby = skidIds(f.standbyskid);
  if (inUse.some((s) => standby.includes(s))) w.push("skid_in_use_and_standby");

  // "meter went down" check: only for single-PRMS messages (one previous value to compare to)
  const prev = opts.previousTotalFlow;
  const tf = prmsList[0].totalflow;
  if (!numbered && prev != null && tf !== null && tf < prev) {
    w.push(`totalflow_decreased(${prev}->${tf})`);
  }

  return { status: w.length ? "needs_review" : "ok", data, warnings: w };
}