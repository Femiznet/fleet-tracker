import { NextRequest } from 'next/server';
import { apiValidationErrorResponse } from '@/lib/api-errors';
import {
  addressCoordinatesSchema,
  fetchHclAddress,
} from '@/lib/hcltracker/address';
import { queryHclTracker } from '@/lib/hcltracker/utils';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = addressCoordinatesSchema.safeParse({
    lat: searchParams.get('lat'),
    lon: searchParams.get('lon'),
  });
  if (!parsed.success) {
    return apiValidationErrorResponse(
      parsed.error,
      'Invalid address coordinates',
    );
  }

  const lat = String(parsed.data.lat);
  const lon = String(parsed.data.lon);

  return queryHclTracker({
    fetchApiWithCookies: (cookies: string) =>
      fetchHclAddress({ lat, lon, cookies }),
    parseResponse: async (res) => ({
      lat,
      lon,
      address: (await res.text()).trim(),
    }),
  });
}
