import { z } from "zod";

// Strict number reader: accepts a number, or a clean numeric string ("1,336,527.2").
// Anything else (e.g. "0 100", "199bar", "Nil") becomes null. It never guesses.
function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.trim().replace(/,/g, "");
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
  }
  return null;
}

function toStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  return v
    .filter((x) => typeof x === "string" || typeof x === "number")
    .map((x) => String(x));
}

const num = z.preprocess(toNumber, z.number().nullable());
const count = z.preprocess(
  toNumber,
  z.number().int().nonnegative().nullable()
);
const text = z.preprocess(
  (v) => (typeof v === "string" && v.trim() ? v.trim() : null),
  z.string().nullable()
);
const ids = z.preprocess(toStringArray, z.array(z.string()).nullable());

export const extractionSchema = z.object({
  data: z.object({
    customer_name: text,
    prms_count: count,
    prms_flows: z
      .preprocess(
        (v) => (Array.isArray(v) ? v : null),
        z.array(z.object({ prms: text, flow_rate: num })).nullable()
      ),
    flow_rate: num, // sum of PRMS flow rates, scm/h
    total_flow: num, // same value as flow_rate (kept for compatibility)
    meter_reading_scm: num, // NEW: cumulative "Total Flow" meter reading, scm
    current_pressure_bar: num,
    empty_skids: count,
    standby_skids: count,
    skid_in_use_count: count,
    skid_in_use_numbers: ids,
    available_trucks: count,
    available_landing_gear_boxes: count,
  }),
  needs_review: z.preprocess((v) => v === true, z.boolean()),
  review_reason: text,
});

export type Extraction = z.infer<typeof extractionSchema>["data"];

// Cheap plausibility rules. Any hit flags the update for review instead of
// letting a bad extraction trigger or hide an alert.
export function sanityIssues(d: Extraction): string[] {
  const issues: string[] = [];

  if (d.current_pressure_bar !== null && (d.current_pressure_bar < 0 || d.current_pressure_bar > 260))
    issues.push(`pressure ${d.current_pressure_bar} bar out of range`);

  if (d.flow_rate !== null && (d.flow_rate < 0 || d.flow_rate > 5000))
    issues.push(`flow rate ${d.flow_rate} scm/h out of range`);

  if (d.meter_reading_scm !== null && d.meter_reading_scm < 0)
    issues.push("negative meter reading");

  if (d.empty_skids !== null && d.empty_skids > 10)
    issues.push(`empty_skids ${d.empty_skids} looks wrong`);

  if (d.standby_skids !== null && d.standby_skids > 10)
    issues.push(`standby_skids ${d.standby_skids} looks like an ID, not a count`);

  if (d.available_trucks !== null && d.available_trucks > 10)
    issues.push(`available_trucks ${d.available_trucks} looks like an ID, not a count`);

  if (
    d.skid_in_use_count !== null &&
    d.skid_in_use_numbers !== null &&
    d.skid_in_use_count !== d.skid_in_use_numbers.length
  )
    issues.push("skid_in_use_count does not match skid_in_use_numbers");

  if (d.prms_flows && d.prms_flows.length > 0 && d.flow_rate !== null) {
    const parts = d.prms_flows.map((p) => p.flow_rate);
    if (parts.every((p): p is number => p !== null)) {
      const sum = parts.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - d.flow_rate) > 0.5)
        issues.push(`PRMS flows sum to ${sum}, but flow_rate is ${d.flow_rate}`);
    }
  }

  return issues;
}

// Use this in processMessage() in place of the "fields" loop.
export function validateExtraction(raw: unknown) {
  const parsed = extractionSchema.safeParse(raw);
  if (!parsed.success) {
    const why = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Schema validation failed: ${why}`);
  }

  const { data, needs_review, review_reason } = parsed.data;
  const issues = sanityIssues(data);
  const reasons = [review_reason, ...issues].filter(Boolean) as string[];

  return {
    data,
    needsReview: needs_review || issues.length > 0,
    reviewReason: reasons.length ? reasons.join("; ") : null,
  };
}