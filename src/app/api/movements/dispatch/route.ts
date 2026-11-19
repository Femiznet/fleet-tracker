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

    const movementId = await createDispatch({
      truckId: body.truckId,
      customerId: body.customerId,
      skidIdOut: body.skidIdOut,
      note: body.note ?? null,
      forceOverride: Boolean(body.forceOverride),
    });

    return NextResponse.json({ movementId }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create dispatch';
    const requiresOverride = message.includes('Use manual override');

    return NextResponse.json(
      { error: message, requiresOverride },
      { status: requiresOverride ? 409 : 400 }
    );
  }
}
