// lib/hcl/vehicles.ts
import { HCL_URL, queryHclTracker } from './utils';

const PAGE_URL = 'ui/admin/payload/table/object/object';

export interface CleanVehicle {
  plateNumber: string;
  speed: string | number;
  address: string;
  status: string;
  group: string | null;
  lat: number | null;
  lon: number | null;
}

interface HCLVehiclePayload {
  data?: {
    data?: {
      current_page?: number;
      last_page?: number;
      data?: Array<{
        plate_number?: string;
        speed?: string | number;
        address?: string;
        status?: string;
        'group.title'?: string | null;
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

export async function parseVehicles(res: Response, filterGroup?: string): Promise<CleanVehicle[]> {
  const payload = (await res.json()) as HCLVehiclePayload;
  const list = payload?.data?.data?.data ?? [];

  const mapped = list.map((item) => {
    const pos = item.config?.components?.position?.props?.position;
    const rawLat = pos?.lat;
    const rawLng = pos?.lng;

    return {
      plateNumber: item.plate_number ?? 'unknown',
      speed: item.speed ?? 'unknown',
      address: item.address ?? 'unknown',
      status: item.status ?? 'unknown',
      group: item['group.title'] ?? item.group?.title ?? null,
      // Fixed: prevents Number(null) from turning into 0
      lat: rawLat !== null && rawLat !== undefined && rawLat !== '' ? Number(rawLat) : null,
      lon: rawLng !== null && rawLng !== undefined && rawLng !== '' ? Number(rawLng) : null,
    };
  });

  if (filterGroup) {
    return mapped.filter((v) => v.group?.toLowerCase() === filterGroup.toLowerCase());
  }

  return mapped;
}

async function fetchVehiclesPage(page: string, limit: string, cookies: string) {
  return fetch(`${HCL_URL}/${PAGE_URL}?page=${page}&per_page=${limit}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Cookie: cookies,
      'X-Requested-With': 'XMLHttpRequest',
    },
    redirect: 'manual',
    cache: 'no-store',
  });
}

// Direct function that returns CleanVehicle[] (no NextResponse wrapper)
export async function getCleanVehicles(
  page = '1',
  limit = '100',
  filterGroup?: string
): Promise<CleanVehicle[]> {
  return queryHclTracker({
    fetchApiWithCookies: (cookies: string) => fetchVehiclesPage(page, limit, cookies),
    parseResponse: (res) => parseVehicles(res, filterGroup),
  });
}
