"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { processQueuedWhatsappUpdates } from "@/features/whatsapp/processor";

export type SaveResult = { ok: boolean; message: string } | null;

async function signedIn() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}

export async function unregisterCustomer(
  _prev: SaveResult,
  formData: FormData
): Promise<SaveResult> {
  if (!(await signedIn())) return { ok: false, message: "Sign in again." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Missing customer." };

  const { error } = await supabaseAdmin
    .from("customers")
    .update({ active: false })
    .eq("id", id);

  if (error) return { ok: false, message: "Could not unregister. Try again." };

  revalidatePath("/dashboard");
  revalidatePath("/customers");
  return { ok: true, message: "Customer unregistered." };
}

export async function registerFromUpdate(
  _prev: SaveResult,
  formData: FormData
): Promise<SaveResult> {
  if (!(await signedIn())) return { ok: false, message: "Sign in again." };

  const name = String(formData.get("name") ?? "").trim();
  const groupName = String(formData.get("group_name") ?? "").trim();

  if (!name) return { ok: false, message: "Enter a name." };
  if (!groupName) return { ok: false, message: "Enter a WhatsApp group name." };

  const { error } = await supabaseAdmin.from("customers").insert({
    name,
    group_name: groupName,
  });

  if (error) {
    return {
      ok: false,
      message:
        error.code === "23505"
          ? "That group is already a customer."
          : "Could not register. Try again.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/customers");
  return { ok: true, message: "Customer registered." };
}

export async function triggerProcessing(
  _prev: SaveResult,
  formData: FormData
): Promise<SaveResult> {
  if (!(await signedIn())) return { ok: false, message: "Sign in again." };

  try {
    const result = await processQueuedWhatsappUpdates();
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: `Processed ${result.processed} update(s).`,
    };
  } catch (error) {
    console.error("Processing failed:", error);
    return { ok: false, message: "Processing failed. Try again." };
  }
}

export async function retryFailedUpdates(
  _prev: SaveResult,
  formData: FormData
): Promise<SaveResult> {
  if (!(await signedIn())) return { ok: false, message: "Sign in again." };

  const { error } = await supabaseAdmin
    .from("whatsapp_updates")
    .update({
      processing_status: "pending",
      processing_error: null,
      processing_attempts: 0,
    })
    .eq("processing_status", "failed");

  if (error) return { ok: false, message: "Could not retry. Try again." };

  revalidatePath("/dashboard");
  return { ok: true, message: "Failed updates queued for retry." };
}