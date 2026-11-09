"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const startDispatchSchema = z.object({
  plateNumber: z.string().trim().min(1).max(100),
  customerStationId: z.uuid(),
});

const updateDispatchSchema = z.object({
  dispatchId: z.uuid(),
  plateNumber: z.string().trim().min(1).max(100),
  customerStationId: z.uuid(),
});

const updateDispatchStatusSchema = z.object({
  dispatchId: z.uuid(),
  status: z.enum(["arrived", "cancelled"]),
});

export type StartDispatchState =
  | { status: "success" | "error"; message: string }
  | null;

export type DispatchActionState =
  | { status: "success" | "error"; message: string }
  | null;

function revalidateDispatchViews() {
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/dashboard/dispatches");
  revalidatePath("/admin/dashboard/vehicles");
}

async function getAdminUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Could not verify dispatch permissions:", authError);
    return { user: null, error: "Could not verify your admin permissions." };
  }

  if (!user) {
    return { user: null, error: "Sign in with an admin account to manage dispatches." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Could not verify dispatch permissions:", profileError);
    return { user: null, error: "Could not verify your admin permissions." };
  }

  if (profile?.role !== "admin") {
    return { user: null, error: "Only admins can manage vehicle dispatches." };
  }

  return { user, error: null };
}

export async function startVehicleDispatch(
  _previousState: StartDispatchState,
  formData: FormData
): Promise<StartDispatchState> {
  const parsed = startDispatchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Select a vehicle and customer station.",
    };
  }

  const { user, error: adminError } = await getAdminUser();
  if (!user) {
    return { status: "error", message: adminError ?? "Only admins can start dispatches." };
  }

  const [{ data: vehicle, error: vehicleError }, { data: station, error: stationError }] =
    await Promise.all([
      supabaseAdmin
        .from("vehicle_tracking")
        .select("plate_number, lat, lon")
        .eq("plate_number", parsed.data.plateNumber)
        .maybeSingle(),
      supabaseAdmin
        .from("stations")
        .select("id, name, latitude, longitude")
        .eq("id", parsed.data.customerStationId)
        .eq("place_kind", "station")
        .maybeSingle(),
    ]);

  if (vehicleError) {
    console.error("Could not load vehicle for dispatch:", vehicleError);
    return { status: "error", message: "Could not load the selected vehicle." };
  }

  if (!vehicle) {
    return { status: "error", message: "That vehicle is no longer available. Refresh and try again." };
  }

  if (stationError) {
    console.error("Could not load customer station for dispatch:", stationError);
    return { status: "error", message: "Could not load the selected customer station." };
  }

  if (!station) {
    return { status: "error", message: "That customer station could not be found." };
  }

  if (station.latitude === null || station.longitude === null) {
    return { status: "error", message: "Add coordinates to the customer station before dispatching." };
  }

  const { error: dispatchError } = await supabaseAdmin
    .from("vehicle_dispatches")
    .insert({
      plate_number: vehicle.plate_number,
      customer_station_id: station.id,
      destination_name: station.name,
      destination_lat: station.latitude,
      destination_lon: station.longitude,
      start_lat: vehicle.lat,
      start_lon: vehicle.lon,
      created_by: user.id,
    });

  if (dispatchError) {
    if (dispatchError.code === "23505") {
      return { status: "error", message: "This vehicle already has an active dispatch." };
    }

    console.error("Could not start vehicle dispatch:", dispatchError);
    return { status: "error", message: "Could not start this dispatch. Please try again." };
  }

  revalidateDispatchViews();
  return {
    status: "success",
    message: `Dispatch started for ${vehicle.plate_number} to ${station.name}.`,
  };
}

export async function updateVehicleDispatch(
  _previousState: DispatchActionState,
  formData: FormData
): Promise<DispatchActionState> {
  const parsed = updateDispatchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Select a vehicle and customer station.",
    };
  }

  const { error: adminError } = await getAdminUser();
  if (adminError) {
    return { status: "error", message: adminError };
  }

  const [{ data: dispatch, error: dispatchError }, { data: vehicle, error: vehicleError }, { data: station, error: stationError }] =
    await Promise.all([
      supabaseAdmin
        .from("vehicle_dispatches")
        .select("id")
        .eq("id", parsed.data.dispatchId)
        .eq("status", "in_transit")
        .maybeSingle(),
      supabaseAdmin
        .from("vehicle_tracking")
        .select("plate_number")
        .eq("plate_number", parsed.data.plateNumber)
        .maybeSingle(),
      supabaseAdmin
        .from("stations")
        .select("id, name, latitude, longitude")
        .eq("id", parsed.data.customerStationId)
        .eq("place_kind", "station")
        .maybeSingle(),
    ]);

  if (dispatchError) {
    console.error("Could not load active dispatch for editing:", dispatchError);
    return { status: "error", message: "Could not load this active dispatch." };
  }
  if (!dispatch) {
    return { status: "error", message: "This dispatch is no longer active. Refresh the dashboard." };
  }
  if (vehicleError) {
    console.error("Could not load vehicle for dispatch edit:", vehicleError);
    return { status: "error", message: "Could not load the selected vehicle." };
  }
  if (!vehicle) {
    return { status: "error", message: "That vehicle is no longer available. Refresh and try again." };
  }
  if (stationError) {
    console.error("Could not load customer station for dispatch edit:", stationError);
    return { status: "error", message: "Could not load the selected customer station." };
  }
  if (!station) {
    return { status: "error", message: "That customer station could not be found." };
  }
  if (station.latitude === null || station.longitude === null) {
    return { status: "error", message: "The customer station must have coordinates before it can be selected." };
  }

  const { data: updatedDispatch, error: updateError } = await supabaseAdmin
    .from("vehicle_dispatches")
    .update({
      plate_number: vehicle.plate_number,
      customer_station_id: station.id,
      destination_name: station.name,
      destination_lat: station.latitude,
      destination_lon: station.longitude,
    })
    .eq("id", dispatch.id)
    .eq("status", "in_transit")
    .select("id")
    .maybeSingle();

  if (updateError) {
    if (updateError.code === "23505") {
      return { status: "error", message: "That vehicle already has another active dispatch." };
    }
    console.error("Could not update vehicle dispatch:", updateError);
    return { status: "error", message: "Could not update this dispatch. Please try again." };
  }
  if (!updatedDispatch) {
    return { status: "error", message: "This dispatch is no longer active. Refresh the dashboard." };
  }

  revalidateDispatchViews();
  return { status: "success", message: "Dispatch details updated." };
}

export async function updateVehicleDispatchStatus(
  _previousState: DispatchActionState,
  formData: FormData
): Promise<DispatchActionState> {
  const parsed = updateDispatchStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: "Choose a valid dispatch action." };
  }

  const { error: adminError } = await getAdminUser();
  if (adminError) {
    return { status: "error", message: adminError };
  }

  const update = parsed.data.status === "arrived"
    ? { status: "arrived" as const, arrived_at: new Date().toISOString() }
    : { status: "cancelled" as const };

  const { data: updatedDispatch, error: updateError } = await supabaseAdmin
    .from("vehicle_dispatches")
    .update(update)
    .eq("id", parsed.data.dispatchId)
    .eq("status", "in_transit")
    .select("id, plate_number")
    .maybeSingle();

  if (updateError) {
    console.error("Could not update vehicle dispatch status:", updateError);
    return { status: "error", message: "Could not update this dispatch. Please try again." };
  }
  if (!updatedDispatch) {
    return { status: "error", message: "This dispatch is no longer active. Refresh the dashboard." };
  }

  const { error: trackingError } = await supabaseAdmin
    .from("vehicle_tracking")
    .update({
      destination_name: "Unknown",
      destination_lat: null,
      destination_lon: null,
      approaching_next: "Set destination",
      remaining_distance_km: null,
    })
    .eq("plate_number", updatedDispatch.plate_number);

  revalidateDispatchViews();
  if (trackingError) {
    console.error("Could not clear the completed dispatch route from vehicle tracking:", trackingError);
    return {
      status: "error",
      message: "Trip status was updated, but its vehicle route could not be cleared. Refresh and check the vehicle details.",
    };
  }

  return {
    status: "success",
    message: parsed.data.status === "arrived" ? "Dispatch marked as completed." : "Dispatch cancelled.",
  };
}
