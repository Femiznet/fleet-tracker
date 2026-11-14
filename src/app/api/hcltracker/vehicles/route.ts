import { NextRequest, NextResponse } from "next/server";
import { HCL_URL, queryHclTracker } from "../hcl-utils";

const PAGE_URL = "ui/admin/payload/table/object/object";

interface UrlSearchParams {
  page: string;
  limit: string;
}

// 1. Minimal shape of the incoming API payload
export interface HCLVehiclePayload {
  data?: {
    data?: {
      current_page?: number;
      last_page?: number;
      data?: Array<{
        plate_number?: string;
        speed?: string | number;
        address?: string;
        status?: string;
        config?: {
          components?: {
            position?: {
              props?: {
                position?: {
                  lat?: string | number;
                  lng?: string | number;
                };
              };
            };
          };
        };
      }>;
    };
  };
}

// 2. Clean, flat interface for your app
export interface CleanVehicle {
  plateNumber: string;
  speed: string | number;
  address: string;
  status: string;
  lat: number | null;
  lng: number | null;
}

export function extractVehicles(payload: HCLVehiclePayload): CleanVehicle[] {
  const list = payload?.data?.data?.data ?? [];

  return list.map((item) => {
    const pos = item.config?.components?.position?.props?.position;

    // Uses config position first, falling back to traccar coordinates
    const rawLat = pos?.lat ?? null;
    const rawLng = pos?.lng ?? null;

    return {
      plateNumber: item.plate_number ?? '',
      speed: item.speed ?? '0 kph',
      address: item.address ?? '',
      status: item.status ?? 'unknown',
      lat: rawLat !== undefined ? Number(rawLat) : null,
      lng: rawLng !== undefined ? Number(rawLng) : null,
    };
  });
}


async function fetchObjects({ params, cookies }: { params: UrlSearchParams, cookies: string }) {
  return fetch(
    `${HCL_URL}/${PAGE_URL}?page=${params.page}&per_page=${params.limit}`,    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Cookie: cookies,
        'X-Requested-With': 'XMLHttpRequest',
      },
      redirect: 'manual',
      cache: 'no-store',
    }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page');
  const limit = searchParams.get('per_page');

  if (!page || !limit) {
    return NextResponse.json(
      { error: 'Both lat and lon query parameters are required.' },
      { status: 400 }
    );
  }

  const params = { page, limit };

  try {
    const fetchObjectTask = (cookies: string) => fetchObjects({ params, cookies });
    return queryHclTracker({
      callback: fetchObjectTask,
      parseResponse: async (res) => {
        const rawJson: HCLVehiclePayload = await res.json();
        const vehicles = extractVehicles(rawJson);
        return vehicles;
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}