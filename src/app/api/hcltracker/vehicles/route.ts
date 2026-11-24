// app/api/hcltracker/vehicles/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-errors';
import { getCleanVehicles } from '@/lib/hcltracker/vehicles';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page');
  const limit = searchParams.get('per_page');

  if (!page || !limit) {
    return NextResponse.json(
      { error: 'Both page and per_page query parameters are required.' },
      { status: 400 }
    );
  }

  try {
    const vehicles = await getCleanVehicles(page, limit);
    return NextResponse.json({ data: vehicles });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to fetch vehicles');
  }
}
