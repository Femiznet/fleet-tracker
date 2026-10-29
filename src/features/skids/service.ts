import { supabase } from "@/lib/supabase";

export async function listSkids() {
  const { data, error } = await supabase
    .from("skids")
    .select("id, skid_no, object_tracker(status, locations(name))")
    .order("skid_no");
  if (error) throw new Error(error.message);
  return data.map((s) => {
    const tr = Array.isArray(s.object_tracker) ? s.object_tracker[0] : s.object_tracker;
    const loc = Array.isArray(tr?.locations) ? tr?.locations[0] : tr?.locations;
    return { id: s.id, skidNo: s.skid_no, status: tr?.status, location: loc?.name };
  });
}

export async function addSkid(
  skidNo: string,
  locationId: string,
  status: "empty" | "loaded" | "maintenance"
) {
  const { data, error } = await supabase
    .from("skids")
    .insert({ skid_no: skidNo })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: e2 } = await supabase
    .from("object_tracker")
    .insert({ skid_id: data.id, location_id: locationId, status });
  if (e2) {
    await supabase.from("skids").delete().eq("id", data.id); // rollback
    throw new Error(e2.message);
  }
}

export async function removeSkid(id: string) {
  const { error } = await supabase.from("skids").delete().eq("id", id);
  if (error) throw new Error(error.message);
}