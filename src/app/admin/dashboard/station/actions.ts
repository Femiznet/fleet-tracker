"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const latitudeSchema = z.preprocess(
  (value) => (value === "" || value == null ? null : value),
  z.coerce.number().finite().min(-90).max(90).nullable()
);

const longitudeSchema = z.preprocess(
  (value) => (value === "" || value == null ? null : value),
  z.coerce.number().finite().min(-180).max(180).nullable()
);

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
  latitude: latitudeSchema,
  longitude: longitudeSchema,
}).refine(
  ({ latitude, longitude }) => (latitude === null) === (longitude === null),
  { message: "Enter both station coordinates, or leave both blank." }
);

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
  latitude: latitudeSchema,
  longitude: longitudeSchema,
}).refine(
  ({ latitude, longitude }) => (latitude === null) === (longitude === null),
  { message: "Enter both station coordinates, or leave both blank." }
);

const milestoneInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  location: z.string().trim().max(300),
  latitude: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().finite().min(-90).max(90)
  ),
  longitude: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().finite().min(-180).max(180)
  ),
});

const resendInvitationSchema = z.object({
  stationId: z.uuid(),
});

export type CreateStationState =
  | { status: "success" | "error"; message: string }
  | null;

export type UpdateStationState = CreateStationState;

function revalidatePlaceViews() {
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/dashboard/places");
  revalidatePath("/admin/dashboard/dispatches");
}

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
    return { authorized: false, error: "Only admins can manage places." };
  }

  return { authorized: true, error: null };
}

async function getInvitationRedirectTo(): Promise<
  { ok: true; redirectTo: string } | { ok: false; error: string }
> {
  const requestHeaders = await headers();
  const appOrigin =
    process.env.NEXT_PUBLIC_SITE_URL ?? requestHeaders.get("origin");

  if (!appOrigin) {
    return {
      ok: false,
      error: "Set NEXT_PUBLIC_SITE_URL or send the request from the app origin to configure invite links.",
    };
  }

  try {
    const url = new URL(appOrigin);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported site URL protocol.");
    }

    return {
      ok: true,
      redirectTo: new URL("/auth/callback", url.origin).toString(),
    };
  } catch {
    return { ok: false, error: "The app site URL for customer invitations is invalid." };
  }
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

  const redirectResult = await getInvitationRedirectTo();
  if (!redirectResult.ok) {
    return { status: "error", message: redirectResult.error };
  }
  const { redirectTo } = redirectResult;

  const { email, name, type, distance, location, latitude, longitude } = parsed.data;
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  const { data: station, error: stationError } = await supabaseAdmin
    .from("stations")
    .insert({
      name,
      slug,
      place_kind: "station",
      type,
      distance: distance ?? null,
      location: location || null,
      latitude,
      longitude,
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

  revalidatePlaceViews();

  return {
    status: "success",
    message: `Station created and an invitation sent to ${email}.`,
  };
}

export async function resendCustomerInvitation(
  _previousState: CreateStationState,
  formData: FormData
): Promise<CreateStationState> {
  const parsed = resendInvitationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: "Could not identify this customer station." };
  }

  const authorization = await isCurrentUserAdmin();
  if (!authorization.authorized) {
    return { status: "error", message: authorization.error };
  }

  const { data: station, error: stationError } = await supabaseAdmin
    .from("stations")
    .select("id, name")
    .eq("id", parsed.data.stationId)
    .eq("place_kind", "station")
    .maybeSingle();

  if (stationError) {
    console.error("Could not load station for invitation resend:", stationError);
    return { status: "error", message: "Could not load this customer station." };
  }
  if (!station) {
    return { status: "error", message: "This customer station no longer exists." };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("station_id", station.id)
    .eq("role", "customer")
    .maybeSingle();

  if (profileError) {
    console.error("Could not load customer account for invitation resend:", profileError);
    return { status: "error", message: "Could not find the customer account for this station." };
  }
  if (!profile) {
    return { status: "error", message: "No customer account is linked to this station." };
  }

  const { data: userResult, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
  if (userError) {
    console.error("Could not load customer account for invitation resend:", userError);
    return { status: "error", message: "Could not load the customer account." };
  }
  if (!userResult.user.email) {
    return { status: "error", message: "The customer account does not have an email address." };
  }
  if (userResult.user.email_confirmed_at) {
    return {
      status: "error",
      message: "This customer has already accepted the invitation. Use the password reset flow if they need account access.",
    };
  }

  const redirectResult = await getInvitationRedirectTo();
  if (!redirectResult.ok) {
    return { status: "error", message: redirectResult.error };
  }

  const { error: invitationError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    userResult.user.email,
    { redirectTo: redirectResult.redirectTo }
  );

  if (invitationError) {
    console.error("Could not resend customer invitation:", invitationError);
    return {
      status: "error",
      message: "Could not resend the invitation. Please try again or check the Supabase Auth email settings.",
    };
  }

  return {
    status: "success",
    message: `Invitation resent to ${userResult.user.email} for ${station.name}.`,
  };
}

export async function createRouteMilestone(
  _previousState: CreateStationState,
  formData: FormData
): Promise<CreateStationState> {
  const parsed = milestoneInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the milestone details and try again.",
    };
  }

  const authorization = await isCurrentUserAdmin();
  if (!authorization.authorized) {
    return { status: "error", message: authorization.error };
  }

  const { name, location, latitude, longitude } = parsed.data;
  const { error } = await supabaseAdmin.from("stations").insert({
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    place_kind: "milestone",
    type: null,
    distance: null,
    location: location || null,
    latitude,
    longitude,
  });

  if (error) {
    if (error.code === "23505" && error.message.includes("stations_slug_key")) {
      return {
        status: "error",
        message: "A place with this name already exists. Choose a different name.",
      };
    }

    console.error("Could not create route milestone:", error);
    return { status: "error", message: "Could not create the milestone. Please try again." };
  }

  revalidatePlaceViews();
  return { status: "success", message: `Route milestone "${name}" created.` };
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

  const { data: existingPlace, error: placeError } = await supabaseAdmin
    .from("stations")
    .select("place_kind")
    .eq("id", parsed.data.stationId)
    .maybeSingle();

  if (placeError) {
    console.error("Could not load place before editing:", placeError);
    return { status: "error", message: "Could not load this place. Please try again." };
  }
  if (!existingPlace) {
    return { status: "error", message: "This place no longer exists. Refresh and try again." };
  }
  if (
    existingPlace.place_kind === "milestone" &&
    (parsed.data.latitude === null || parsed.data.longitude === null)
  ) {
    return { status: "error", message: "Route milestones must have both coordinates." };
  }

  const { stationId, name, type, distance, location, latitude, longitude } = parsed.data;
  const { error } = await supabaseAdmin
    .from("stations")
    .update({
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      type,
      distance: distance ?? null,
      location: location || null,
      latitude,
      longitude,
    })
    .eq("id", stationId);

  if (error) {
    console.error("Could not update place:", error);
    return {
      status: "error",
      message: error.code === "23505"
        ? "A place with this name already exists. Choose a different name."
        : "Could not update this place. Please try again.",
    };
  }

  revalidatePlaceViews();
  return {
    status: "success",
    message: existingPlace.place_kind === "milestone"
      ? "Milestone details updated."
      : "Station details updated.",
  };
}
