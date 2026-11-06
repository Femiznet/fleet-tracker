"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Wrapper for form action - accepts only formData (Next.js form signature)
// addCustomer has signature (_prev: SaveResult, formData: FormData)
// but forms expect (formData: FormData)
export async function handleAddCustomer(formData: FormData) {
  const supabase = supabaseAdmin;
  const { error } = await supabase.from("customers")
    .insert({ name: String(formData.get("name") ?? ""), group_name: String(formData.get("group_name") ?? "") });
  
  if (error) throw error;
  
  revalidatePath("/customers");
  revalidatePath("/dashboard");
  redirect("/customers");
}

export type SaveResult = { ok: boolean; message: string } | null;

async function signedIn() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}

function readNumber(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export async function updateCustomer(
  _prev: SaveResult,
  formData: FormData
): Promise<SaveResult> {
  if (!(await signedIn())) return { ok: false, message: "Sign in again to save." };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const cutoff = readNumber(formData.get("cutoff_bar"));
  const trip = readNumber(formData.get("trip_minutes"));
  const full = readNumber(formData.get("full_bar"));
  const active = formData.get("active") === "on";

  if (!id) return { ok: false, message: "Missing customer." };
  if (!name) return { ok: false, message: "Enter a name." };
  if (cutoff === null || Number.isNaN(cutoff) || cutoff <= 0 || cutoff > 100)
    return { ok: false, message: "Cutoff pressure must be between 0 and 100 bar." };
  if (full === null || Number.isNaN(full) || full < 100 || full > 300)
    return { ok: false, message: "Full pressure must be between 100 and 300 bar." };
  if (cutoff >= full)
    return { ok: false, message: "Cutoff pressure must be lower than full pressure." };
  if (trip !== null && (Number.isNaN(trip) || !Number.isInteger(trip) || trip < 0 || trip > 1440))
    return { ok: false, message: "Trip time must be whole minutes (0 to 1440), or empty if unknown." };

  const { error } = await supabaseAdmin
    .from("customers")
    .update({ name, cutoff_bar: cutoff, trip_minutes: trip, full_bar: full, active })
    .eq("id", id);

  if (error) return { ok: false, message: "Could not save. Try again." };

  revalidatePath("/customers");
  revalidatePath("/dashboard");
  return { ok: true, message: "Saved." };
}

export async function deleteCustomer(
  _prev: SaveResult,
  formData: FormData
): Promise<SaveResult> {
  if (!(await signedIn())) return { ok: false, message: "Sign in again to delete." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Missing customer." };

  const { error } = await supabaseAdmin.from("customers").delete().eq("id", id);
  if (error) return { ok: false, message: "Could not delete. Remove related records first or try again." };

  revalidatePath("/customers");
  revalidatePath("/dashboard");
  revalidatePath("/plant");
  return { ok: true, message: "Customer deleted." };
}

export async function addCustomer(
  _prev: SaveResult,
  formData: FormData
): Promise<SaveResult> {
  if (!(await signedIn())) return { ok: false, message: "Sign in again to save." };

  const groupName = String(formData.get("group_name") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!groupName) return { ok: false, message: "Enter a WhatsApp group name." };
  if (!name) return { ok: false, message: "Enter a name." };

  const { error } = await supabaseAdmin
    .from("customers")
    .insert({ name, group_name: groupName });

  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "That group is already a customer." : "Could not add. Try again.",
    };
  }

  revalidatePath("/customers");
  revalidatePath("/dashboard");
  return { ok: true, message: "Added." };
}
