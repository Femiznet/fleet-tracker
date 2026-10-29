import { supabase } from "@/lib/supabase";

export type TrackStatus = "online" | "in_transit" | "empty" | "loaded" | "maintenance";

export async function setStatus(kind: "truck" | "skid", id: string, status: TrackStatus) {
  const { error } = await supabase
    .from("object_tracker")
    .update({ status, updated_at: new Date().toISOString() })
    .eq(kind === "truck" ? "truck_id" : "skid_id", id);
  if (error) throw new Error(error.message);
}