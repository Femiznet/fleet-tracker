import { supabase } from "@/lib/supabase";

// Supabase may type a joined row as an object or an array; normalise it.
const one = <T,>(v: T | T[] | null | undefined): T | undefined =>
  Array.isArray(v) ? v[0] : v ?? undefined;

export async function listDriverOptions() {
  const { data, error } = await supabase.from("drivers").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return data.map((d) => ({ value: d.id, label: d.name }));
}

export async function listMotormateOptions() {
  const { data, error } = await supabase.from("motormates").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return data.map((m) => ({ value: m.id, label: m.name }));
}

export async function listTruckOptions() {
  const { data, error } = await supabase.from("trucks").select("id, plate_number").order("plate_number");
  if (error) throw new Error(error.message);
  return data.map((t) => ({ value: t.id, label: t.plate_number }));
}

// ---- driver <-> motormate ----
export async function listCrewPairs() {
  const { data, error } = await supabase
    .from("driver_motormate")
    .select("id, drivers(name), motormates(name)");
  if (error) throw new Error(error.message);
  return data.map((r) => ({
    id: r.id,
    driver: one(r.drivers)?.name ?? "?",
    motormate: one(r.motormates)?.name ?? "?",
  }));
}

export async function addCrewPair(driverId: string, motormateId: string) {
  // Is this motormate already paired with someone?
  const { data: taken, error: e1 } = await supabase
    .from("driver_motormate")
    .select("driver_id, drivers(name), motormates(name)")
    .eq("motormate_id", motormateId)
    .maybeSingle();
  if (e1) throw new Error(e1.message);

  if (taken && taken.driver_id !== driverId) {
    const mate = one(taken.motormates)?.name ?? "Motormate";
    const owner = one(taken.drivers)?.name ?? "another driver";
    throw new Error(`${mate} is already assigned to ${owner}`);
  }
  if (taken) return; // this exact pairing already exists

  // Insert, or move the driver to the new motormate.
  const { error } = await supabase
    .from("driver_motormate")
    .upsert({ driver_id: driverId, motormate_id: motormateId }, { onConflict: "driver_id" });
  if (error) throw new Error(error.message);
}


export async function removeCrewPair(id: string) {
  const { error } = await supabase.from("driver_motormate").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---- driver <-> truck ----
export async function listTruckAssignments() {
  const { data, error } = await supabase
    .from("driver_trucks")
    .select("id, drivers(name), trucks(plate_number)");
  if (error) throw new Error(error.message);
  return data.map((r) => ({
    id: r.id,
    driver: one(r.drivers)?.name ?? "?",
    plate: one(r.trucks)?.plate_number ?? "?",
  }));
}

export async function addTruckAssignment(driverId: string, truckId: string) {
  // Is this truck already assigned to someone?
  const { data: taken, error: e1 } = await supabase
    .from("driver_trucks")
    .select("driver_id, drivers(name), trucks(plate_number)")
    .eq("truck_id", truckId)
    .maybeSingle();
  if (e1) throw new Error(e1.message);

  if (taken && taken.driver_id !== driverId) {
    const plate = one(taken.trucks)?.plate_number ?? "Truck";
    const owner = one(taken.drivers)?.name ?? "another driver";
    throw new Error(`${plate} is already assigned to ${owner}`);
  }
  if (taken) return;

  const { error } = await supabase
    .from("driver_trucks")
    .upsert({ driver_id: driverId, truck_id: truckId }, { onConflict: "driver_id" });
  if (error) throw new Error(error.message);
}

export async function removeTruckAssignment(id: string) {
  const { error } = await supabase.from("driver_trucks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}