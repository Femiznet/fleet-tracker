import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Could not verify dispatch option request:", authError);
    return NextResponse.json({ error: "Could not verify your session." }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: "Sign in to search dispatch options." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Could not verify dispatch option permissions:", profileError);
    return NextResponse.json({ error: "Could not verify your permissions." }, { status: 500 });
  }
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Only administrators can search dispatch options." }, { status: 403 });
  }

  const kind = request.nextUrl.searchParams.get("kind");
  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const include = request.nextUrl.searchParams.get("include");
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;

  if (kind === "vehicle") {
    let vehiclesQuery = supabaseAdmin
      .from("vehicle_tracking")
      .select("plate_number, fleet_owner")
      .order("plate_number")
      .limit(50);
    if (query) vehiclesQuery = vehiclesQuery.ilike("plate_number", pattern);
    const { data, error } = await vehiclesQuery;

    if (error) {
      console.error("Could not search dispatch vehicles:", error);
      return NextResponse.json({ error: "Could not search vehicles." }, { status: 500 });
    }
    const plates = data.map((vehicle) => vehicle.plate_number);
    const { data: activeDispatches, error: activeError } = plates.length
      ? await supabaseAdmin
        .from("vehicle_dispatches")
        .select("plate_number")
        .eq("status", "in_transit")
        .in("plate_number", plates)
      : { data: [], error: null };
    if (activeError) {
      console.error("Could not load active vehicle assignments:", activeError);
      return NextResponse.json({ error: "Could not check vehicle availability." }, { status: 500 });
    }
    const activePlates = new Set(activeDispatches.map((dispatch) => dispatch.plate_number));
    return NextResponse.json({
      options: data.filter((vehicle) => !activePlates.has(vehicle.plate_number) || vehicle.plate_number === include)
        .slice(0, 15)
        .map((vehicle) => ({
        value: vehicle.plate_number,
        label: vehicle.plate_number,
        detail: vehicle.fleet_owner,
        })),
    });
  }

  if (kind === "station") {
    let stationsQuery = supabaseAdmin
      .from("stations")
      .select("id, name")
      .eq("place_kind", "station")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("name")
      .limit(15);
    if (query) stationsQuery = stationsQuery.ilike("name", pattern);
    const { data, error } = await stationsQuery;

    if (error) {
      console.error("Could not search dispatch stations:", error);
      return NextResponse.json({ error: "Could not search customer stations." }, { status: 500 });
    }
    return NextResponse.json({
      options: data.map((station) => ({
        value: station.id,
        label: station.name,
        detail: "",
      })),
    });
  }

  return NextResponse.json({ error: "Choose a valid dispatch option type." }, { status: 400 });
}
