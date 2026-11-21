// lib/hcltracker/address.ts
import { HCL_URL, queryHclTracker } from '@/backend/lib/hcltracker/utils';

async function fetchAddress({
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
    }
  );
}

export async function getCleanAddress(lat: number, lon: number): Promise<string | null> {
  try {
    const latStr = String(lat);
    const lonStr = String(lon);

    const response = await queryHclTracker({
      fetchApiWithCookies: (cookies: string) =>
        fetchAddress({ lat: latStr, lon: lonStr, cookies }),
      parseResponse: async (res) => ({
        lat: latStr,
        lon: lonStr,
        address: (await res.text()).trim(),
      }),
    });

    if (!response.ok) return null;

    const json = await response.json();
    return json.data?.address?.trim() || null;
  } catch (error) {
    console.error('Failed to resolve location from HCL Tracker:', error);
    return null;
  }
}
