import { supabase } from "@/lib/supabase";
import { one } from "@/lib/utils";

function friendly(msg: string) {
  if (msg.includes("one_active_dispatch_per_truck")) return "This truck is already on an active trip";
  if (msg.includes("one_active_dispatch_per_driver")) return "This driver is already on an active trip";
  if (msg.includes("one_active_dispatch_per_motormate")) return "This motormate is already on an active trip";
  if (msg.includes("one_active_dispatch_per_skid")) return "This skid is already on an active trip";
  return msg;
}

export async function loadDispatchData() {
  const [trk, skd, asg, pairs, mgr] = await Promise.all([
    supabase.from("object_tracker").select("location_id, status, trucks(id, plate_number)").not("truck_id", "is", null),
    supabase.from("object_tracker").select("location_id, status, skids(id, skid_no)").not("skid_id", "is", null),
    supabase.from("driver_trucks").select("driver_id, truck_id"),
    supabase.from("driver_motormate").select("driver_id, motormate_id"),
    supabase.from("managers").select("id, name").order("name"),
  ]);
  for (const r of [trk, skd, asg, pairs, mgr]) if (r.error) throw new Error(r.error.message);

  const trucks = (trk.data ?? []).flatMap((r) => {
    const t = one(r.trucks);
    return t ? [{ id: t.id, plate: t.plate_number, locationId: r.location_id, status: r.status }] : [];
  });
  const skids = (skd.data ?? []).flatMap((r) => {
    const s = one(r.skids);
    return s ? [{ id: s.id, skidNo: s.skid_no, locationId: r.location_id, status: r.status }] : [];
  });

  const driverByTruck: Record<string, string> = {};
  (asg.data ?? []).forEach((a) => (driverByTruck[a.truck_id] = a.driver_id));
  const mateByDriver: Record<string, string> = {};
  (pairs.data ?? []).forEach((p) => (mateByDriver[p.driver_id] = p.motormate_id));

  return {
    trucks,
    skids,
    driverByTruck,
    mateByDriver,
    managers: (mgr.data ?? []).map((m) => ({ value: m.id, label: m.name })),
  };
}

export type NewDispatch = {
  managerId: string;
  truckId: string;
  driverId: string;
  motormateId?: string;
  skidId?: string;
  origin: string;
  destination: string;
};

export async function createDispatch(d: NewDispatch) {
  const { error } = await supabase.from("trip_tracker").insert({
    manager_id: d.managerId,
    truck_id: d.truckId,
    driver_id: d.driverId,
    motormate_id: d.motormateId || null,
    skid_id: d.skidId || null,
    origin: d.origin,
    destination: d.destination,
  });
  if (error) throw new Error(friendly(error.message));
}

export async function listActiveTrips() {
  const { data, error } = await supabase
    .from("trip_tracker")
    .select(
      "id, created_at, managers(name), drivers(name), motormates(name), trucks(plate_number), skids(skid_no), origin_loc:locations!origin(name), dest_loc:locations!destination(name)"
    )
    .eq("status", "in_transit")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map((t) => ({
    id: t.id,
    createdAt: t.created_at,
    manager: one(t.managers)?.name ?? "?",
    driver: one(t.drivers)?.name ?? "?",
    motormate: one(t.motormates)?.name ?? null,
    plate: one(t.trucks)?.plate_number ?? "?",
    skid: one(t.skids)?.skid_no ?? null,
    from: one(t.origin_loc)?.name ?? "?",
    to: one(t.dest_loc)?.name ?? "?",
  }));
}

async function finish(id: string, status: "arrived" | "cancelled") {
  const { error } = await supabase.from("trip_tracker").update({ status }).eq("id", id);
  if (error) throw new Error(friendly(error.message));
}
export const arriveDispatch = (id: string) => finish(id, "arrived");
export const cancelDispatch = (id: string) => finish(id, "cancelled");