"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const stationInputSchema = z.object({
  email: z.email().transform((email) => email.trim().toLowerCase()),
  name: z.string().trim().min(1).max(120),
  type: z.preprocess(
    (value) => (value === "" ? null : value),
    z.enum(["METER", "SELF-PICK", "WAYBILL"]).nullable()
  ),
  distance: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().finite().min(0).max(99999999.99).optional()
  ),
  location: z.string().trim().max(300),
});

const stationUpdateSchema = z.object({
  stationId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  type: z.preprocess(
    (value) => (value === "" ? null : value),
    z.enum(["METER", "SELF-PICK", "WAYBILL"]).nullable()
  ),
  distance: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().finite().min(0).max(99999999.99).optional()
  ),
  location: z.string().trim().max(300),
});

export type CreateStationState =
  | { status: "success" | "error"; message: string }
  | null;

export type UpdateStationState = CreateStationState;

async function isCurrentUserAdmin(): Promise<
  { authorized: true; error: null } | { authorized: false; error: string }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: "Sign in with an admin account to manage stations." };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return { authorized: false, error: "Could not verify your admin permissions." };
  }

  if (profile?.role !== "admin") {
    return { authorized: false, error: "Only admins can manage customer stations." };
  }

  return { authorized: true, error: null };
}

async function removeStation(stationId: string) {
  const { error } = await supabaseAdmin
    .from("stations")
    .delete()
    .eq("id", stationId);

  return error;
}

export async function createCustomerStation(
  _previousState: CreateStationState,
  formData: FormData
): Promise<CreateStationState> {
  const parsed = stationInputSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the station details and try again.",
    };
  }

  const authorization = await isCurrentUserAdmin();
  if (!authorization.authorized) {
    return { status: "error", message: authorization.error };
  }

  const requestHeaders = await headers();
  const appOrigin =
    process.env.NEXT_PUBLIC_SITE_URL ?? requestHeaders.get("origin");

  console.log("ORIGIN", appOrigin);

  if (!appOrigin) {
    return {
      status: "error",
      message: "Set NEXT_PUBLIC_SITE_URL or send the request from the app origin to configure invite links.",
    };
  }

  let redirectTo: string;
  try {
    const url = new URL(appOrigin);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported site URL protocol.");
    }
    redirectTo = new URL("/auth/callback", url.origin).toString();
  } catch {
    return {
      status: "error",
      message: "The app site URL for customer invitations is invalid.",
    };
  }

  console.log("REDIRECT-TO:", redirectTo);

  const { email, name, type, distance, location } = parsed.data;
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  const { data: station, error: stationError } = await supabaseAdmin
    .from("stations")
    .insert({
      name,
      slug,
      type,
      distance: distance ?? null,
      location: location || null,
    })
    .select("id")
    .single();

  if (stationError) {
    if (
      stationError.code === "23505" &&
      stationError.message.includes("stations_slug_key")
    ) {
      return {
        status: "error",
        message: "A station with this name already exists. Choose a different station name.",
      };
    }

    console.error("Could not create customer station:", stationError);
    return {
      status: "error",
      message: "Could not create the station. Please try again.",
    };
  }

  let invitationResult: Awaited<
    ReturnType<typeof supabaseAdmin.auth.admin.inviteUserByEmail>
  >;
  try {
    invitationResult = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });
  } catch (error) {
    const cleanupError = await removeStation(station.id);
    const reason =
      error instanceof Error ? error.message : "Unexpected invitation error.";

    return {
      status: "error",
      message: cleanupError
        ? `Invitation failed (${reason}); station ${station.id} could not be removed (${cleanupError.message}).`
        : `Invitation failed: ${reason}`,
    };
  }

  const { data: invitation, error: invitationError } = invitationResult;

  if (invitationError || !invitation.user) {
    const cleanupError = await removeStation(station.id);
    const reason =
      invitationError?.message ?? "Supabase did not return the invited customer account.";

    return {
      status: "error",
      message: cleanupError
        ? `Invitation failed (${reason}); station ${station.id} could not be removed (${cleanupError.message}).`
        : `Invitation failed: ${reason}`,
    };
  }

  const { error: createProfileError } = await supabaseAdmin.from("profiles").insert({
    id: invitation.user.id,
    role: "customer",
    station_id: station.id,
  });

  if (createProfileError) {
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(
      invitation.user.id
    );
    const cleanupError = await removeStation(station.id);
    const cleanupDetails = [
      deleteUserError && `invited account cleanup failed: ${deleteUserError.message}`,
      cleanupError && `station cleanup failed: ${cleanupError.message}`,
    ]
      .filter(Boolean)
      .join("; ");

    return {
      status: "error",
      message: cleanupDetails
        ? `Could not link the customer profile: ${createProfileError.message}. ${cleanupDetails}. Station ID: ${station.id}; invited user ID: ${invitation.user.id}.`
        : `Could not link the customer profile: ${createProfileError.message}. The invitation was canceled and the station was removed.`,
    };
  }

  revalidatePath("/admin/dashboard");

  return {
    status: "success",
    message: `Station created and an invitation sent to ${email}.`,
  };
}

export async function updateCustomerStation(
  _previousState: UpdateStationState,
  formData: FormData
): Promise<UpdateStationState> {
  const parsed = stationUpdateSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the station details and try again.",
    };
  }

  const authorization = await isCurrentUserAdmin();
  if (!authorization.authorized) {
    return { status: "error", message: authorization.error };
  }

  const { stationId, name, type, distance, location } = parsed.data;
  const { error } = await supabaseAdmin
    .from("stations")
    .update({
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      type,
      distance: distance ?? null,
      location: location || null,
    })
    .eq("id", stationId);

  if (error) {
    return {
      status: "error",
      message: `Could not update the station: ${error.message}`,
    };
  }

  revalidatePath("/admin/dashboard");
  return { status: "success", message: "Station details updated." };
}
