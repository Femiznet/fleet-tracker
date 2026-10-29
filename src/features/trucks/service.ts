import { supabase } from "@/lib/supabase";
import { one } from "@/lib/utils";

export type TruckState = "good" | "maintenance";

// Find a company ignoring case, or create it.
async function companyId(raw: string) {
  const name = raw.trim().replace(/\s+/g, " ");
  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .ilike("name", name.replace(/[%_\\]/g, "\\$&"))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data.id;

  const { data: created, error: e2 } = await supabase
    .from("companies")
    .insert({ name })
    .select("id")
    .single();
  if (e2) throw new Error(e2.message);
  return created.id;
}

export async function listCompanyNames() {
  const { data, error } = await supabase.from("companies").select("name").order("name");
  if (error) throw new Error(error.message);
  return data.map((c) => c.name);
}

export async function addTruck(v: {
  plate: string;
  company: string;
  locationId: string;
  state: TruckState;
}) {
  const { error } = await supabase.from("trucks").insert({
    plate_number: v.plate.trim().toUpperCase(),
    company_id: await companyId(v.company),
    location_id: v.locationId,
    state: v.state,
  });
  if (error) {
    throw new Error(error.message.includes("plate_number") ? "Plate number already registered" : error.message);
  }
}

export async function removeTruck(id: string) {
  const { error } = await supabase.from("trucks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Basic list, just so you can see what you registered.
export async function listTrucks() {
  const { data, error } = await supabase
    .from("trucks")
    .select("id, plate_number, state, status, location_id, companies(name), locations(name), drivers(name)")
    .order("plate_number");
  if (error) throw new Error(error.message);
  return data.map((t) => ({
    id: t.id,
    plate: t.plate_number,
    state: t.state as TruckState,
    status: t.status as "standby" | "assigned",
    driver: one(t.drivers)?.name ?? "",
    company: one(t.companies)?.name ?? "?",
    locationId: t.location_id,
    location: one(t.locations)?.name ?? "?",
  }));
}
export type TruckRow = Awaited<ReturnType<typeof listTrucks>>[number];

export async function updateTruck(
  id: string,
  v: { plate: string; company: string; locationId: string; state: TruckState }
) {
  const { error } = await supabase
    .from("trucks")
    .update({
      plate_number: v.plate.trim().toUpperCase(),
      company_id: await companyId(v.company),
      location_id: v.locationId,
      state: v.state,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    throw new Error(error.message.includes("plate_number") ? "Plate number already registered" : error.message);
  }
}