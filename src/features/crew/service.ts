import { supabase } from "@/lib/supabase";
import { one } from "@/lib/utils";

export type CrewKind = "drivers" | "motormates" | "managers";

export const CREW_LABEL: Record<CrewKind, { one: string; many: string }> = {
  drivers: { one: "driver", many: "Drivers" },
  motormates: { one: "motormate", many: "Motormates" },
  managers: { one: "manager", many: "Managers" },
};

export type CrewInput = { name: string; phone: string; motormateId?: string; truckId?: string };

const SELECT: Record<CrewKind, string> = {
  drivers: "id, name, phone_number, motormate_id, truck_id, motormates(name), trucks(plate_number)",
  motormates: "id, name, phone_number, drivers(name)",
  managers: "id, name, phone_number",
};

export async function listCrew(kind: CrewKind) {
  const { data, error } = await supabase.from(kind).select(SELECT[kind]).order("name");
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as unknown as any[]).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    phone: (r.phone_number ?? "") as string,
    motormateId: (r.motormate_id ?? "") as string,
    truckId: (r.truck_id ?? "") as string,
    motormateName: (one(r.motormates)?.name ?? "") as string,
    truckPlate: (one(r.trucks)?.plate_number ?? "") as string,
    driverName: (one(r.drivers)?.name ?? "") as string, // for motormates: who they're with
  }));
}
export type CrewRow = Awaited<ReturnType<typeof listCrew>>[number];

// options for the driver's dropdowns
export async function listLinkOptions() {
  const [m, t] = await Promise.all([
    supabase.from("motormates").select("id, name").order("name"),
    supabase.from("trucks").select("id, plate_number, state").order("plate_number"),
  ]);
  if (m.error) throw new Error(m.error.message);
  if (t.error) throw new Error(t.error.message);
  return {
    motormates: m.data.map((x) => ({ value: x.id, label: x.name })),
    trucks: t.data.filter((x) => x.state === "good").map((x) => ({ value: x.id, label: x.plate_number })),
  };
}

function clean(kind: CrewKind, v: CrewInput) {
  const base = {
    name: v.name.trim().replace(/\s+/g, " "),
    phone_number: v.phone.replace(/[\s\-()]/g, "") || null,
  };
  if (kind !== "drivers") return base;
  return { ...base, motormate_id: v.motormateId || null, truck_id: v.truckId || null };
}

// "already assigned to <name>" instead of a raw duplicate-key error
async function checkTaken(selfId: string | null, v: CrewInput) {
  const checks = [
    ["truck_id", v.truckId, "truck"],
    ["motormate_id", v.motormateId, "motormate"],
  ] as const;
  for (const [col, val, what] of checks) {
    if (!val) continue;
    let q = supabase.from("drivers").select("name").eq(col, val);
    if (selfId) q = q.neq("id", selfId);
    const { data, error } = await q.maybeSingle();
    if (error) throw new Error(error.message);
    if (data) throw new Error(`This ${what} is already assigned to ${data.name}`);
  }
}

function friendly(kind: CrewKind, msg: string) {
  if (msg.includes("name_lower_key") || msg.includes("_name_unique")) return `A ${CREW_LABEL[kind].one} with this name already exists`;
  if (msg.includes("phone_number")) return "This phone number is already registered";
  return msg;
}

export async function addCrew(kind: CrewKind, v: CrewInput) {
  if (kind === "drivers") await checkTaken(null, v);
  const { error } = await supabase.from(kind).insert(clean(kind, v));
  if (error) throw new Error(friendly(kind, error.message));
}

export async function updateCrew(kind: CrewKind, id: string, v: CrewInput) {
  if (kind === "drivers") await checkTaken(id, v);
  const { error } = await supabase.from(kind).update(clean(kind, v)).eq("id", id);
  if (error) throw new Error(friendly(kind, error.message));
}

export async function removeCrew(kind: CrewKind, id: string) {
  const { error } = await supabase.from(kind).delete().eq("id", id);
  if (error) {
    const msg = error.message;
    if (msg.includes("23503") || msg.toLowerCase().includes("violates foreign key")) {
      const what = kind === "drivers" ? "driver" : kind === "motormates" ? "motormate" : "manager";
      throw new Error(`Cannot delete: this ${what} is used in trips`);
    }
    throw new Error(msg);
  }
}