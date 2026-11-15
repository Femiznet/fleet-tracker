import { z } from "zod";

/**
 * parseUpdate.ts  -  pure function, no DB, no framework.
 * text in -> { kind, status, data, warnings } out.
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
  reportedAt: z.string().nullish().transform((v) => v ?? null),
});

export type CustomerUpdateMessage = z.infer<typeof CustomerUpdateMessageSchema>;
export type Skids = z.infer<typeof skids>;

export type ParseResult =
  | { kind: "ignored"; reason: string }
  | {
      kind: "update";
      status: "ok" | "needs_review";
      data: CustomerUpdateMessage;
      warnings: string[];
    };

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
  ["flowrate", String.raw`flow\s*-?\s*rate`],
  ["totalflow", String.raw`total\s*flow|total(?=\s*[:(])`],
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


/** cut the message at every label; text between two labels is the value */
function extractFields(text: string): Record<string, string> {
  const flat = text.replace(/\s+/g, " ");
  const hits: { name: string; start: number; end: number }[] = [];
  for (const m of flat.matchAll(LABEL_RE)) {
    const name = LABEL_NAMES.find((n) => m.groups?.[n] !== undefined)!;
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
export function parseUpdate(text: string, opts: ParseOptions = {}): ParseResult {
  if (/skid\s*change\s*details/i.test(text)) {
    return { kind: "ignored", reason: "skid_change_report" };
  }
  const f = extractFields(text);
  const core = ["pressure", "flowrate", "totalflow"].filter((k) => k in f);
  if (core.length < 2) return { kind: "ignored", reason: "not_a_station_update" };

  const inUse = skidIds(f.skidinuse);
  const prms = {
    id: 1,
    pressure: toNumber(f.pressure),
    flowrate: toNumber(f.flowrate),
    totalflow: toNumber(f.totalflow),
    skidinuse: oneOrMany(inUse),
  };
  const trucks = parseTrucks(f.availabletrucks);
  const draft = {
    PRMS: [prms],
    outletpressure: toNumber(f.outletpressure),
    standbyskid: oneOrMany(skidIds(f.standbyskid)),
    emptyskid: oneOrMany(skidIds(f.emptyskid)),
    availabletrucks: trucks.value,
  };

  // shape guard: throws if we ever build something that isn't the clean format
  // (e.g. a NaN). The raw message is safe in `messages`, so it can be re-parsed.
  const data = CustomerUpdateMessageSchema.parse(draft);

  // ------------------------------------------------------------ validate
  const w: string[] = [];
  if (trucks.warn) w.push(trucks.warn);
  const check = (key: keyof typeof RANGES, val: number | null, required: boolean) => {
    if (val === null) { if (required) w.push(`missing_${key}`); return; }
    const [lo, hi] = RANGES[key];
    if (val < lo || val > hi) w.push(`out_of_range_${key}=${val}`);
  };
  check("pressure", prms.pressure, true);
  check("flowrate", prms.flowrate, true);
  check("totalflow", prms.totalflow, true);
  check("outletpressure", data.outletpressure, false);

  const idle = prms.flowrate === 0 && prms.pressure === 0;
  if (inUse.length === 0 && !idle) w.push("missing_skidinuse");

  const standby = skidIds(f.standbyskid);
  if (inUse.some((s) => standby.includes(s))) w.push("skid_in_use_and_standby");

  const prev = opts.previousTotalFlow;
  if (prev != null && prms.totalflow !== null && prms.totalflow < prev) {
    w.push(`totalflow_decreased(${prev}->${prms.totalflow})`);
  }

  return { kind: "update", status: w.length ? "needs_review" : "ok", data, warnings: w };
}