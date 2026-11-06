import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type WhatsappUpdate =
  Database["public"]["Tables"]["whatsapp_updates"]["Insert"];

export async function saveWhatsappUpdate(data: WhatsappUpdate) {
  const fiveMinutesAgo = new Date(
    Date.now() - 5 * 60 * 1000
  ).toISOString();

  let query = supabase
    .from("whatsapp_updates")
    .select("id")
    .eq("message", data.message)
    .gte("received_at", fiveMinutesAgo);

  query = data.notification_title == null
    ? query.is("notification_title", null)
    : query.eq("notification_title", data.notification_title);

  const { data: existing, error: checkError } = await query.maybeSingle();

  if (checkError) throw checkError;

  if (existing) {
    return { duplicate: true, id: existing.id };
  }

  const { data: result, error } = await supabase
    .from("whatsapp_updates")
    .insert(data)
    .select()
    .single();

  if (error) throw error;

  return { duplicate: false, data: result };
}