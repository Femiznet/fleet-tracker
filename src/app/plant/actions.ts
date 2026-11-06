"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function userId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Sends the person back to /plant, keeping their search, with an optional message.
function back(formData: FormData, msg: { error?: string; notice?: string } = {}): never {
  const p = new URLSearchParams();
  const q = String(formData.get("q") ?? "");
  if (q) p.set("q", q);
  if (msg.error) p.set("error", msg.error);
  if (msg.notice) p.set("notice", msg.notice);

  const explicitOpen = text(formData, "open");
  const kind = text(formData, "kind");
  const id = text(formData, "id");
  const open = explicitOpen || (kind && id ? `${kind}:${id}` : id ? `skid:${id}` : text(formData, "truck") ? `truck:${text(formData, "truck")}` : text(formData, "skid") ? `skid:${text(formData, "skid")}` : "");
  if (open) p.set("open", open);

  revalidatePath("/plant");
  const s = p.toString();
  redirect(s ? `/plant?${s}` : "/plant");
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

// "2026-11-04T14:05" from a datetime-local input, entered in Lagos time (UTC+1).
function readTime(formData: FormData): string | null | "invalid" {
  const raw = text(formData, "at").trim();
  if (!raw) return null;
  const d = new Date(`${raw}:00+01:00`);
  if (Number.isNaN(d.getTime())) return "invalid";
  if (d.getTime() > Date.now() + 5 * 60 * 1000) return "invalid";
  return d.toISOString();
}

export async function recordArrival(formData: FormData) {
  const uid = await userId();
  if (!uid) back(formData, { error: "Sign in again." });
  const at = readTime(formData);
  if (at === "invalid") back(formData, { error: "Check the date and time. It can't be in the future." });

  const { error } = await supabaseAdmin.rpc("record_arrival", {
    p_truck: text(formData, "truck") || null,
    p_skid: text(formData, "skid") || null,
    p_gas: text(formData, "gas") || null,
    p_at: at,
    p_note: text(formData, "note").trim() || null,
    p_user: uid,
  });
  back(formData, error ? { error: error.message } : { notice: "Arrival recorded." });
}

export async function recordDispatch(formData: FormData) {
  const uid = await userId();
  if (!uid) back(formData, { error: "Sign in again." });
  const at = readTime(formData);
  if (at === "invalid") back(formData, { error: "Check the date and time. It can't be in the future." });

  const { error } = await supabaseAdmin.rpc("record_dispatch", {
    p_truck: text(formData, "truck"),
    p_skid: text(formData, "skid") || null,
    p_customer: text(formData, "customer") || null,
    p_at: at,
    p_note: text(formData, "note").trim() || null,
    p_user: uid,
  });
  back(formData, error ? { error: error.message } : { notice: "Dispatch recorded." });
}

// From a truck card (hidden truck, chosen skid) or a skid card (hidden skid, chosen truck).
export async function hookSkid(formData: FormData) {
  const uid = await userId();
  if (!uid) back(formData, { error: "Sign in again." });
  const truck = text(formData, "truck");
  const skid = text(formData, "skid");
  if (!truck || !skid) back(formData, { error: "Choose what to hook." });

  const { error } = await supabaseAdmin.rpc("hook_skid", { p_truck: truck, p_skid: skid, p_user: uid });
  back(formData, error ? { error: error.message } : { notice: "Hooked." });
}

export async function unhookSkid(formData: FormData) {
  const uid = await userId();
  if (!uid) back(formData, { error: "Sign in again." });

  const { error } = await supabaseAdmin.rpc("unhook_skid", { p_skid: text(formData, "id"), p_user: uid });
  back(formData, error ? { error: error.message } : { notice: "Unhooked." });
}

export async function setGasState(formData: FormData) {
  const uid = await userId();
  if (!uid) back(formData, { error: "Sign in again." });

  const { error } = await supabaseAdmin.rpc("set_gas_state", {
    p_skid: text(formData, "id"),
    p_state: text(formData, "state"),
    p_user: uid,
  });
  back(formData, error ? { error: error.message } : { notice: "Skid status updated." });
}

export async function setMaintenance(formData: FormData) {
  const uid = await userId();
  if (!uid) back(formData, { error: "Sign in again." });
  const kind = text(formData, "kind");
  if (kind !== "truck" && kind !== "skid") back(formData, { error: "Unknown item type." });
  const on = text(formData, "on") === "1";

  const { error } = await supabaseAdmin.rpc("set_maintenance", {
    p_kind: kind,
    p_id: text(formData, "id"),
    p_on: on,
    p_note: text(formData, "note").trim() || null,
    p_user: uid,
  });
  back(formData, error ? { error: error.message } : { notice: on ? "Sent to maintenance." : "Back in service." });
}

function parseLines(raw: string) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const v = line.trim().replace(/\s+/g, " ").toUpperCase();
    const key = v.replace(/[^A-Z0-9]/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export async function registerTrucks(formData: FormData) {
  if (!(await userId())) back(formData, { error: "Sign in again." });
  const lines = parseLines(text(formData, "list"));
  if (!lines.length) back(formData, { error: "Paste at least one plate number." });

  const { data, error } = await supabaseAdmin
    .from("trucks")
    .upsert(lines.map((plate_number) => ({ plate_number })), {
      onConflict: "plate_key",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) back(formData, { error: "Could not register trucks. Try again." });
  back(formData, {
    notice: `Added ${data?.length ?? 0} of ${lines.length} trucks. The rest were already registered.`,
  });
}

export async function registerSkids(formData: FormData) {
  if (!(await userId())) back(formData, { error: "Sign in again." });
  const lines = parseLines(text(formData, "list"));
  if (!lines.length) back(formData, { error: "Paste at least one skid number." });

  const { data, error } = await supabaseAdmin
    .from("skids")
    .upsert(lines.map((skid_number) => ({ skid_number })), {
      onConflict: "skid_key",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) back(formData, { error: "Could not register skids. Try again." });
  back(formData, {
    notice: `Added ${data?.length ?? 0} of ${lines.length} skids. The rest were already registered.`,
  });
}
