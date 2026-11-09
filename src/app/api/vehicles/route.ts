import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// 1. Structural schema definition matching your exact API payload
interface HCLPositionProps {
  position?: string | { lat: number | string; lng: number | string } | [number | string, number | string];
}

interface HCLVehicleData {
  id: number;
  plate_number?: string;
  object_owner?: string;
  speed?: number | string;
  status?: string;
  distance?: number | string;
  address?: string;
  ignition_duration?: string | number;
  traccar?: {
    server_time?: string;
  };
  config?: {
    components?: {
      position?: {
        props?: HCLPositionProps;
      };
    };
  };
}

// 2. The Outer Wrappers: data.data.data
interface HCLOuterPayload {
  data?: {
    data?: {
      current_page?: number;
      data?: HCLVehicleData[];
    };
  };
}

interface OSRMRoute {
  distance: number;
  geometry?: {
    coordinates: [number, number][];
    type: 'LineString';
  };
  legs?: {
    steps?: OSRMStep[];
  }[];
}

interface OSRMStep {
  name?: string;
  ref?: string;
  maneuver: {
    type: string;
    modifier?: string;
  };
}

interface OSRMResponse {
  routes?: OSRMRoute[];
}

interface RegisteredMilestone {
  name: string;
  lat: number;
  lon: number;
}

interface CustomerStation {
  name: string;
  lat: number | null;
  lon: number | null;
  previousDistanceKm: number | null;
}

interface ProcessedVehicleUpdate {
  plateNumber: string;
  fleetOwner: string;
  speed: string | number;
  status: string;
  totalMileage: string | number;
  lastSync: string;
  currentAddress: string;
  ignitionDuration: string | number;
  coordinates: { lat: number; lon: number };
  remainingDistanceKm: number | null;
  approachingNext: string;
  destinationName: string;
  destinationLat: number | null;
  destinationLon: number | null;
  updatedAt: string;
}

const UNKNOWN_DESTINATION: CustomerStation = {
  name: 'Unknown',
  lat: null,
  lon: null,
  previousDistanceKm: null
};

const destinationSchema = z.object({
  plateNumber: z.string().trim().min(1).max(100),
  destinationName: z.string().trim().min(1).max(120),
  destinationLat: z.number().finite().min(-90).max(90),
  destinationLon: z.number().finite().min(-180).max(180)
});

function parseCoordinates(rawPosition: HCLPositionProps['position']): { lat: number; lon: number } | null {
  let latValue: number | string;
  let lonValue: number | string;

  if (typeof rawPosition === 'string') {
    const parts = rawPosition.split(',');
    if (parts.length !== 2) return null;
    [latValue, lonValue] = parts;
  } else if (Array.isArray(rawPosition) && rawPosition.length === 2) {
    [latValue, lonValue] = rawPosition;
  } else if (rawPosition && typeof rawPosition === 'object') {
    ({ lat: latValue, lng: lonValue } = rawPosition);
  } else {
    return null;
  }

  const lat = typeof latValue === 'number' ? latValue : Number.parseFloat(latValue.trim());
  const lon = typeof lonValue === 'number' ? lonValue : Number.parseFloat(lonValue.trim());

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }

  return { lat, lon };
}

function getNextRouteMilestone(route: OSRMRoute): string | null {
  const steps = route.legs?.flatMap((leg) => leg.steps ?? []) ?? [];
  const nextStep = steps.find((step) =>
    step.maneuver.type !== 'depart' &&
    step.maneuver.type !== 'arrive' &&
    Boolean(step.name?.trim() || step.ref?.trim())
  );

  if (nextStep) {
    return nextStep.name?.trim() || nextStep.ref?.trim() || null;
  }

  const nextManeuver = steps.find((step) =>
    step.maneuver.type !== 'depart' && step.maneuver.type !== 'arrive'
  )?.maneuver;

  if (!nextManeuver) return null;
  if (nextManeuver.modifier) {
    return `Next ${nextManeuver.modifier} turn`;
  }

  return `Next ${nextManeuver.type.replaceAll('_', ' ')}`;
}

function getNextRegisteredMilestone(
  route: OSRMRoute,
  milestones: RegisteredMilestone[]
): string | null {
  const coordinates = route.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2 || milestones.length === 0) return null;

  const segmentLengthsKm: number[] = [];
  let routeLengthKm = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const [lon1, lat1] = coordinates[index - 1]!;
    const [lon2, lat2] = coordinates[index]!;
    const segmentLengthKm = getDistanceKm(lat1, lon1, lat2, lon2);
    segmentLengthsKm.push(segmentLengthKm);
    routeLengthKm += segmentLengthKm;
  }

  let nearest: { name: string; distanceFromRouteKm: number; alongRouteKm: number } | null = null;
  for (const milestone of milestones) {
    let distanceBeforeSegmentKm = 0;
    for (let index = 1; index < coordinates.length; index += 1) {
      const [lon1, lat1] = coordinates[index - 1]!;
      const [lon2, lat2] = coordinates[index]!;
      const meanLatRadians = ((lat1 + lat2 + milestone.lat) / 3) * Math.PI / 180;
      const xScale = 111.32 * Math.cos(meanLatRadians);
      const yScale = 111.32;
      const segmentX = (lon2 - lon1) * xScale;
      const segmentY = (lat2 - lat1) * yScale;
      const milestoneX = (milestone.lon - lon1) * xScale;
      const milestoneY = (milestone.lat - lat1) * yScale;
      const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
      const projection = segmentLengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, (milestoneX * segmentX + milestoneY * segmentY) / segmentLengthSquared));
      const offsetX = milestoneX - projection * segmentX;
      const offsetY = milestoneY - projection * segmentY;
      const distanceFromRouteKm = Math.hypot(offsetX, offsetY);

      if (distanceFromRouteKm <= 1 && distanceBeforeSegmentKm + projection * segmentLengthsKm[index - 1]! > 0.25) {
        const alongRouteKm = distanceBeforeSegmentKm + projection * segmentLengthsKm[index - 1]!;
        if (!nearest || alongRouteKm < nearest.alongRouteKm) {
          nearest = { name: milestone.name, distanceFromRouteKm, alongRouteKm };
        }
      }

      distanceBeforeSegmentKm += segmentLengthsKm[index - 1]!;
    }
  }

  if (!nearest || nearest.alongRouteKm > routeLengthKm) return null;
  return nearest.name;
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const rawPayload = (await request.json()) as HCLOuterPayload;

    // Unpack data.data.data safely
    const vehiclesData: HCLVehicleData[] = rawPayload.data?.data?.data ?? [];

    if (vehiclesData.length === 0) {
      return NextResponse.json({ success: true, message: 'No vehicle records found in nested payload array.' });
    }

    const plateNumbers = [...new Set(vehiclesData.map((vehicle) => vehicle.plate_number).filter((plate): plate is string => Boolean(plate)))];
    if (plateNumbers.length === 0) {
      return NextResponse.json({ success: true, processedCount: 0, data: [] });
    }

    const [
      { data: savedDestinations, error: destinationsError },
      { data: activeDispatches, error: activeDispatchesError },
      { data: savedMilestones, error: milestonesError }
    ] = await Promise.all([
      supabaseAdmin
        .from('vehicle_tracking')
        .select('plate_number, destination_name, destination_lat, destination_lon, remaining_distance_km')
        .in('plate_number', plateNumbers),
      supabaseAdmin
        .from('vehicle_dispatches')
        .select('plate_number, destination_name, destination_lat, destination_lon')
        .in('plate_number', plateNumbers)
        .eq('status', 'in_transit'),
      supabaseAdmin
        .from('stations')
        .select('name, latitude, longitude')
        .eq('place_kind', 'milestone')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
    ]);

    if (destinationsError || activeDispatchesError || milestonesError) {
      console.error('Could not load vehicle route data:', destinationsError ?? activeDispatchesError ?? milestonesError);
      return NextResponse.json({ error: 'Could not load vehicle route data' }, { status: 500 });
    }

    const milestones: RegisteredMilestone[] = savedMilestones
      .filter((milestone) => milestone.latitude !== null && milestone.longitude !== null)
      .map((milestone) => ({
        name: milestone.name,
        lat: milestone.latitude!,
        lon: milestone.longitude!
      }));

    const destinationsByPlate = new Map<string, CustomerStation>(
      savedDestinations.map((destination) => [
        destination.plate_number,
        {
          name: destination.destination_name,
          lat: destination.destination_lat,
          lon: destination.destination_lon,
          previousDistanceKm: destination.remaining_distance_km
        }
      ])
    );

    const activeDestinationsByPlate = new Map(
      activeDispatches.map((dispatch) => [
        dispatch.plate_number,
        {
          name: dispatch.destination_name,
          lat: dispatch.destination_lat,
          lon: dispatch.destination_lon,
          previousDistanceKm: destinationsByPlate.get(dispatch.plate_number)?.previousDistanceKm ?? null
        }
      ])
    );

    const updatesProcessing = vehiclesData.map(async (vehicle: HCLVehicleData): Promise<ProcessedVehicleUpdate | null> => {
        const plateNumber = vehicle.plate_number ?? '';
        if (!plateNumber) return null;

        const coordinates = parseCoordinates(vehicle.config?.components?.position?.props?.position);
        if (!coordinates) return null;
        const { lat: currentLat, lon: currentLon } = coordinates;

        const destination =
          activeDestinationsByPlate.get(plateNumber) ??
          destinationsByPlate.get(plateNumber) ??
          UNKNOWN_DESTINATION;
        const hasDestination = destination.name !== 'Unknown' && destination.lat !== null && destination.lon !== null;
        let remainingDistanceKm = hasDestination ? destination.previousDistanceKm : null;
        let routeAvailable = false;
        let nextRouteMilestone: string | null = null;

        if (hasDestination) {
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${currentLon},${currentLat};${destination.lon},${destination.lat}?steps=true&overview=full&geometries=geojson`;

          try {
            const osrmResponse = await fetch(osrmUrl);
            if (!osrmResponse.ok) {
              throw new Error(`OSRM request failed with status ${osrmResponse.status}`);
            }
            const osrmData = (await osrmResponse.json()) as OSRMResponse;

            if (osrmData.routes && osrmData.routes.length > 0 && osrmData.routes[0]) {
              const targetedRoute = osrmData.routes[0];
              remainingDistanceKm = targetedRoute.distance / 1000;
              routeAvailable = true;
              nextRouteMilestone =
                getNextRegisteredMilestone(targetedRoute, milestones) ??
                getNextRouteMilestone(targetedRoute);
            }
          } catch (routingErr) {
            console.error(`Could not generate predictive route for ${plateNumber}:`, routingErr);
          }
        }

        return {
          plateNumber,
          fleetOwner: vehicle.object_owner ?? 'Unknown',
          speed: vehicle.speed ?? 0,
          status: vehicle.status ?? 'unknown',
          totalMileage: vehicle.distance ?? 0,
          currentAddress: vehicle.address ?? 'No address provided',
          ignitionDuration: vehicle.ignition_duration ?? 0,
          lastSync: vehicle.traccar?.server_time ?? new Date().toISOString(),
          coordinates: { lat: currentLat, lon: currentLon },
          remainingDistanceKm: remainingDistanceKm === null ? null : parseFloat(remainingDistanceKm.toFixed(1)),
          approachingNext: !hasDestination
            ? 'Set destination'
            : !routeAvailable
              ? 'Route unavailable'
              : remainingDistanceKm !== null && remainingDistanceKm <= 2
              ? 'Arriving Soon'
              : nextRouteMilestone ?? 'Next route step',
          destinationName: destination.name,
          destinationLat: destination.lat,
          destinationLon: destination.lon,
          updatedAt: new Date().toISOString()
        };
      });



    const resolvedUpdates = await Promise.all(updatesProcessing);
    const processedUpdates = resolvedUpdates.filter((update): update is ProcessedVehicleUpdate => update !== null);

    if (processedUpdates.length > 0) {
      // Format camelCase objects to match snake_case SQL Columns
      const supabasePayload = processedUpdates.map(update => ({
        plate_number: update.plateNumber,
        fleet_owner: update.fleetOwner,
        speed: typeof update.speed === 'string' ? parseFloat(update.speed) : update.speed,
        status: update.status,
        total_mileage: typeof update.totalMileage === 'string' ? parseFloat(update.totalMileage) : update.totalMileage,
        current_address: update.currentAddress,
        approaching_next: update.approachingNext,
        remaining_distance_km: update.remainingDistanceKm,
        destination_name: update.destinationName,
        destination_lat: update.destinationLat,
        destination_lon: update.destinationLon,
        lat: update.coordinates.lat,
        lon: update.coordinates.lon,
        last_sync: update.lastSync
      }));

      const { error } = await supabaseAdmin
        .from('vehicle_tracking')
        .upsert(supabasePayload, { onConflict: 'plate_number' });

      if (error) {
        console.error('Supabase Upsert Error:', error);
        return NextResponse.json({ error: 'Database save failed' }, { status: 500 });
      }
    }


    console.log(`🚀 [HCL Sync Router] Correctly processed page ${rawPayload.data?.data?.current_page ?? 'unknown'} containing ${processedUpdates.length} trucks.`);

    return NextResponse.json({
      success: true,
      processedCount: processedUpdates.length,
      data: processedUpdates
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Sign in to update vehicle destinations.' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Could not verify vehicle destination permissions:', profileError);
    return NextResponse.json({ error: 'Could not verify permissions.' }, { status: 500 });
  }

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can update vehicle destinations.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const parsed = destinationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid destination details.' }, { status: 400 });
  }

  const { plateNumber, destinationName, destinationLat, destinationLon } = parsed.data;
  const { data, error } = await supabaseAdmin
    .from('vehicle_tracking')
    .update({
      destination_name: destinationName,
      destination_lat: destinationLat,
      destination_lon: destinationLon
    })
    .eq('plate_number', plateNumber)
    .select('plate_number')
    .maybeSingle();

  if (error) {
    console.error('Could not update vehicle destination:', error);
    return NextResponse.json({ error: 'Could not save the vehicle destination.' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Vehicle not found. Sync the vehicle before setting its destination.' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
