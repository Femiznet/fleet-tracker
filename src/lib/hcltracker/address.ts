// lib/hcltracker/address.ts
import { HCL_URL, queryHclTracker } from '@/lib/hcltracker/utils';
import { z } from 'zod';

const coordinate = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .transform(Number)
    .pipe(z.number().finite().min(min).max(max));

export const addressCoordinatesSchema = z
  .object({
    lat: coordinate(-90, 90),
    lon: coordinate(-180, 180),
  })
  .strict();

export async function fetchHclAddress({
  lat,
  lon,
  cookies,
}: {
  lat: string;
  lon: string;
  cookies: string;
}) {
  return fetch(
    `${HCL_URL}/ui/address?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Cookie: cookies,
        'X-Requested-With': 'XMLHttpRequest',
      },
      redirect: 'manual',
      cache: 'no-store',
    },
  );
}

async function responseError(response: Response): Promise<Error> {
  const payload: unknown = await response.json();
  const message =
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof payload.error === 'string'
      ? payload.error
      : `HCL tracker address request failed with status ${response.status}`;
  return new Error(message);
}

export async function getCleanAddress(
  lat: number,
  lon: number,
): Promise<string | null> {
  const coordinates = addressCoordinatesSchema.parse({
    lat: String(lat),
    lon: String(lon),
  });
  const latStr = String(coordinates.lat);
  const lonStr = String(coordinates.lon);

  const response = await queryHclTracker({
    fetchApiWithCookies: (cookies: string) =>
      fetchHclAddress({ lat: latStr, lon: lonStr, cookies }),
    parseResponse: async (res) => ({
      lat: latStr,
      lon: lonStr,
      address: (await res.text()).trim(),
    }),
  });

  if (!response.ok) {
    throw await responseError(response);
  }

  const payload: unknown = await response.json();
  const parsed = z
    .object({ data: z.object({ address: z.string() }) })
    .safeParse(payload);
  if (!parsed.success) {
    throw new Error('HCL tracker returned an invalid address response');
  }

  return parsed.data.data.address.trim() || null;
}
