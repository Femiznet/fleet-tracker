import { supabase } from "@/lib/supabase";

export async function listLocations() {
  const { data, error } = await supabase.from("locations").select("*").order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listLocationOptions() {
  return (await listLocations()).map((l) => ({ value: l.id, label: l.name }));
}

export async function addLocation(name: string, type: string) {
  const { error } = await supabase.from("locations").insert({ name, type });
  if (error) throw new Error(error.message);
}

export async function removeLocation(id: string) {
  const { error } = await supabase.from("locations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}