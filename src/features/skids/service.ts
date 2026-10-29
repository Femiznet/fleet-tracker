import { supabase } from "@/lib/supabase";
import { one } from "@/lib/utils";

export type SkidState = "good" | "maintenance";
export type SkidStatus = "empty" | "loading" | "loaded";

export interface SkidRow {
  id: string;
  skidNumber: string;
  location: string;
  locationId: string;
  state: SkidState;
  status: SkidStatus;
}

export async function listSkids(): Promise<SkidRow[]> {
  const { data, error } = await supabase.from("skids").select("id, skid_number, state, status, location_id, locations(name)").order("skid_number");
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((s) => ({
    id: s.id as string,
    skidNumber: s.skid_number as string,
    location: one(s.locations)?.name ?? "",
    locationId: s.location_id as string,
    state: s.state as SkidState,
    status: s.status as SkidStatus,
  }));
}

export async function listSkidOptions() {
  const { data, error } = await supabase.from("locations").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((l) => ({ value: l.id, label: l.name }));
}

function clean(v: string) { return v.trim().replace(/\s+/g, " "); }

export async function addSkid(v: { skidNumber: string; locationId: string; state: SkidState; status: SkidStatus }) {
  const { error } = await supabase.from("skids").insert({ skid_number: clean(v.skidNumber).toUpperCase(), location_id: v.locationId, state: v.state, status: v.status });
  if (error) throw new Error(error.message.includes("skids_number_lower_key") ? "Skid number already registered" : error.message);
}

export async function updateSkid(id: string, v: { skidNumber: string; locationId: string; state: SkidState; status: SkidStatus }) {
  const { error } = await supabase.from("skids").update({ skid_number: clean(v.skidNumber).toUpperCase(), location_id: v.locationId, state: v.state, status: v.status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message.includes("skids_number_lower_key") ? "Skid number already registered" : error.message);
}

export async function removeSkid(id: string) {
  const { error } = await supabase.from("skids").delete().eq("id", id);
  if (error) throw new Error(error.message.includes("violates foreign key") ? "Cannot delete: this skid is in use" : error.message);
}
