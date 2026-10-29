import { supabase } from "@/lib/supabase";
import { one } from "@/lib/utils";

export type TripStatus = "in_transit" | "arrived" | "cancelled";

export interface TripRow {
  id: string;
  truck: string;
  driver: string;
  motormate: string;
  manager: string;
  from: string;
  to: string;
  status: TripStatus;
  createdAt: string;
  completedAt: string | null;
}

export async function listTrips(): Promise<TripRow[]> {
  const { data, error } = await supabase
    .from("truck_trips")
    .select("id, created_at, completed_at, status, trucks(plate_number), drivers(name), motormates(name), managers(name), locations!truck_trips_origin_id_fkey(name), destination:locations!truck_trips_destination_id_fkey(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((t) => ({
    id: t.id as string,
    truck: one(t.trucks)?.plate_number ?? "",
    driver: one(t.drivers)?.name ?? "",
    motormate: one(t.motormates)?.name ?? "",
    manager: one(t.managers)?.name ?? "",
    from: one(t.locations)?.name ?? "",
    to: one(t.destination)?.name ?? "",
    status: t.status as TripStatus,
    createdAt: t.created_at as string,
    completedAt: (t.completed_at ?? null) as string | null,
  }));
}

export interface TripOptions {
  trucks: { value: string; label: string; locationId: string; locationName: string; driverId: string; motormateId: string }[];
drivers: { value: string; label: string; motormateId: string }[];
  motormates: { value: string; label: string }[];
  managers: { value: string; label: string }[];
  locations: { value: string; label: string }[];
}

export async function listTripOptions(): Promise<TripOptions> {
  const [trucksRes, driversRes, motormatesRes, managersRes, locsRes, tripsRes] = await Promise.all([
    supabase.from("trucks").select("id, plate_number, state, location_id, location:locations(name), driver:drivers(id, name, motormate_id)").order("plate_number"),
    supabase.from("drivers").select("id, name, motormate_id").order("name"),
    supabase.from("motormates").select("id, name").order("name"),
    supabase.from("managers").select("id, name").order("name"),
    supabase.from("locations").select("id, name").order("name"),
    supabase.from("truck_trips").select("truck_id").eq("status", "in_transit"),
  ]);
  if (trucksRes.error) throw new Error(trucksRes.error.message);
  if (driversRes.error) throw new Error(driversRes.error.message);
  if (motormatesRes.error) throw new Error(motormatesRes.error.message);
  if (managersRes.error) throw new Error(managersRes.error.message);
  if (locsRes.error) throw new Error(locsRes.error.message);
  if (tripsRes.error) throw new Error(tripsRes.error.message);
  const inTransit = new Set((tripsRes.data ?? []).map((t: { truck_id: string }) => t.truck_id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trucks = ((trucksRes.data ?? []) as any[])
    .filter((t) => t.state === "good" && !inTransit.has(t.id))
    .map((t) => {
      const d = one(t.driver);
      return {
        value: t.id as string,
        label: t.plate_number as string,
        locationId: t.location_id as string,
        locationName: (one(t.location)?.name ?? "") as string,
        driverId: (d?.id ?? "") as string,
        motormateId: (d?.motormate_id ?? "") as string,
      };
    });
  return {
    trucks,
    drivers: (driversRes.data ?? []).map((d: { id: string; name: string; motormate_id: string | null }) => ({ value: d.id, label: d.name, motormateId: d.motormate_id ?? "" })),
    motormates: (motormatesRes.data ?? []).map((m) => ({ value: m.id, label: m.name })),
    managers: (managersRes.data ?? []).map((m) => ({ value: m.id, label: m.name })),
    locations: (locsRes.data ?? []).map((l) => ({ value: l.id, label: l.name })),
  };
}

function friendly(msg: string) {
  if (msg.includes("trip_trips_in_transit_truck_id_key")) return "This truck is already on a trip";
  if (msg.includes("trip_trips_in_transit_driver_id_key")) return "This driver is already on a trip";
  if (msg.includes("trip_trips_in_transit_motormate_id_key")) return "This motormate is already on a trip";
  if (msg.toLowerCase().includes("in maintenance")) return "Truck is in maintenance";
  return msg;
}

export async function startTrip(v: { truckId: string; driverId: string; motormateId?: string; managerId: string; destinationId: string }) {
  const { error } = await supabase.from("truck_trips").insert({
    truck_id: v.truckId,
    driver_id: v.driverId,
    motormate_id: v.motormateId || null,
    manager_id: v.managerId,
    destination_id: v.destinationId,
  } as never);
  if (error) throw new Error(friendly(error.message));
}

export async function setTripStatus(id: string, status: "arrived" | "cancelled") {
  const { error } = await supabase.from("truck_trips").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeTrip(id: string) {
  const { data } = await supabase.from("truck_trips").select("status").eq("id", id).single();
  if (data?.status !== "cancelled") throw new Error("Only cancelled trips can be deleted");
  const { error } = await supabase.from("truck_trips").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
