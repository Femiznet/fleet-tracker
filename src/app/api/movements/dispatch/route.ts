import { createDispatch } from '@/services/dispatch';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.truckId || !body.customerId || !body.skidIdOut) {
      return NextResponse.json(
        { error: 'truckId, customerId, and skidIdOut are required' },
        { status: 400 }
      );
    }

    const trackingMode = body.trackingMode ?? 'live';
    if (trackingMode !== 'live' && trackingMode !== 'manual') {
      return NextResponse.json(
        { error: 'trackingMode must be "live" or "manual"' },
        { status: 400 }
      );
    }

    const movementId = await createDispatch({
      truckId: body.truckId,
      customerId: body.customerId,
      skidIdOut: body.skidIdOut,
      note: body.note ?? null,
      trackingMode,
    });

    return NextResponse.json({ movementId }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create dispatch';
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
