// lib/hcl/vehicles.ts
import { z } from 'zod';
import { HCL_URL, queryHclTracker } from './utils';

const PAGE_URL = 'ui/admin/payload/table/object/object';

const cleanVehicleSchema = z.object({
  plateNumber: z.string(),
  speed: z.union([z.string(), z.number()]),
  address: z.string(),
  status: z.string(),
  group: z.string().nullable(),
  lat: z.number().finite().min(-90).max(90).nullable(),
  lon: z.number().finite().min(-180).max(180).nullable(),
});

export type CleanVehicle = z.infer<typeof cleanVehicleSchema>;

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

export async function parseVehicles(
  res: Response,
  filterGroup?: string,
): Promise<CleanVehicle[]> {
  const payload = (await res.json()) as HCLVehiclePayload;
  const list = payload?.data?.data?.data;
  if (!Array.isArray(list)) {
    throw new Error('HCL tracker returned an invalid vehicle list');
  }

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
      lat: parseCoordinate(rawLat, -90, 90),
      lon: parseCoordinate(rawLng, -180, 180),
    };
  });

  const parsed = z.array(cleanVehicleSchema).safeParse(mapped);
  if (!parsed.success) {
    throw new Error('HCL tracker returned invalid vehicle data');
  }

  if (filterGroup) {
    return parsed.data.filter(
      (v) => v.group?.toLowerCase() === filterGroup.toLowerCase(),
    );
  }

  return parsed.data;
}

function parseCoordinate(
  value: string | number | null | undefined,
  min: number,
  max: number,
): number | null {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max
    ? coordinate
    : null;
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

export async function getCleanVehicles(
  page = '1',
  limit = '100',
  filterGroup?: string,
): Promise<CleanVehicle[]> {
  const result = await queryHclTracker({
    fetchApiWithCookies: (cookies: string) =>
      fetchVehiclesPage(page, limit, cookies),
    parseResponse: (res) => parseVehicles(res, filterGroup),
  });

  if (!(result instanceof Response)) {
    throw new Error('HCL tracker returned an invalid response');
  }

  const payload: unknown = await result.json();
  if (!result.ok) {
    const errorMessage =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `HCL tracker request failed with status ${result.status}`;
    throw new Error(errorMessage);
  }

  const parsed = z
    .object({ data: z.array(cleanVehicleSchema) })
    .safeParse(payload);
  if (!parsed.success) {
    throw new Error('HCL tracker returned an invalid vehicle response');
  }

  return parsed.data.data;
}
