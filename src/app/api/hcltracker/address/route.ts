import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-errors';
import { HCL_URL, queryHclTracker } from '@/lib/hcltracker/utils';

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
    return NextResponse.json(
      { error: 'Both lat and lon query parameters are required.' },
      { status: 400 }
    );
  }

  try {
    const fetchAddressTask = (cookies: string) => fetchAddress({ lat, lon, cookies });
    return queryHclTracker({
      fetchApiWithCookies: fetchAddressTask,
      parseResponse: async (res) => ({
        lat,
        lon,
        address: (await res.text()).trim(),
      }),
    });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to fetch address');
  }
}






