"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SaveResult = { ok: boolean; message: string } | null;

export async function saveAlertPreferences(
  _prev: SaveResult,
  formData: FormData
): Promise<SaveResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, message: "Sign in again to save your settings." };

  const dashboard = formData.get("dashboard_alerts") === "on";
  const whatsapp = formData.get("whatsapp_alerts") === "on";
  const raw = String(formData.get("whatsapp_number") ?? "").replace(/[\s-]/g, "");
  const number = raw === "" ? null : raw;

  if (number && !/^\+[1-9]\d{7,14}$/.test(number)) {
    return {
      ok: false,
      message: "Enter the number with its country code, for example +2348012345678.",
    };
  }
  if (whatsapp && !number) {
    return { ok: false, message: "Add a WhatsApp number to turn on WhatsApp alerts." };
  }

  const { error } = await supabase.from("alert_preferences").upsert({
    user_id: user.id,
    dashboard_alerts: dashboard,
    whatsapp_alerts: whatsapp,
    whatsapp_number: number,
    updated_at: new Date().toISOString(),
  });

  if (error) return { ok: false, message: "Could not save your settings. Try again." };

  revalidatePath("/settings/alerts");
  return { ok: true, message: "Saved." };
}