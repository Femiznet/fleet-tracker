import { NextRequest, NextResponse } from "next/server";
import { HCL_URL, queryHclTracker } from "../hcl-utils";

const PAGE_URL = "ui/admin/payload/table/object/object";

interface UrlSearchParams {
  page: string;
  limit: string;
}

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
        "group.title"?: string | null;
        group?: { id?: number; title?: string } | null;
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

export interface CleanVehicle {
  plateNumber: string;
  speed: string | number;
  address: string;
  status: string;
  group: string | null;
  lat: number | null;
  lon: number | null;
}

export async function parseVehicles(
  res: Response,
  filterGroup?: string
): Promise<CleanVehicle[]> {
  const payload = (await res.json()) as HCLVehiclePayload;
  const list = payload?.data?.data?.data ?? [];

  const mapped = list.map((item) => {
    const pos = item.config?.components?.position?.props?.position;
    const rawLat = pos?.lat ?? null;
    const rawLng = pos?.lng ?? null;

    return {
      plateNumber: item.plate_number ?? 'unknown',
      speed: item.speed ?? 'unknown',
      address: item.address ?? 'unknown',
      status: item.status ?? 'unknown',
      group: item["group.title"] ?? item.group?.title ?? null,
      lat: rawLat !== undefined ? Number(rawLat) : null,
      lon: rawLng !== undefined ? Number(rawLng) : null,
    };
  });

  if (filterGroup) {
    return mapped.filter(
      (v) => v.group?.toLowerCase() === filterGroup.toLowerCase()
    );
  }

  return mapped;
}

async function fetchVehicles({ params, cookies }: { params: UrlSearchParams, cookies: string }) {
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
    return queryHclTracker({
      fetchApiWithCookies: (cookies: string) => fetchVehicles({ params, cookies }),
      parseResponse: (res) => parseVehicles(res),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}