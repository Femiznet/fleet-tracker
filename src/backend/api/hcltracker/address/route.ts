import { NextRequest } from 'next/server';
import { HCL_URL, queryHclTracker } from '@/backend/lib/hcltracker/utils';
import { apiError, apiSuccess } from '@/backend/lib/api-response';

async function fetchAddress({lat, lon, cookies}:{lat: string, lon: string, cookies: string}) {
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Both lat and lon query parameters are required.' }, 400);
  }

  try {
    const fetchAddressTask = (cookies: string) => fetchAddress({ lat, lon, cookies });
    const data = await queryHclTracker({
      fetchApiWithCookies: fetchAddressTask,
      parseResponse: async (res) => ({
        lat,
        lon,
        address: (await res.text()).trim(),
      }),
    });
    return apiSuccess(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return apiError({ code: 'UPSTREAM_ERROR', message }, 502);
  }
}






