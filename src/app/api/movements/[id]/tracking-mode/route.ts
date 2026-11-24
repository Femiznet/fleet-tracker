import { switchDispatchTrackingMode } from '@/services/dispatch';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body: unknown = await req.json().catch(() => null);

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      !('trackingMode' in body)
    ) {
      return NextResponse.json(
        { error: 'trackingMode must be "live" or "manual"' },
        { status: 400 }
      );
    }

    const trackingMode = body.trackingMode;
    if (trackingMode !== 'live' && trackingMode !== 'manual') {
      return NextResponse.json(
        { error: 'trackingMode must be "live" or "manual"' },
        { status: 400 }
      );
    }

    await switchDispatchTrackingMode({ movementId: id, trackingMode });

    return NextResponse.json({ movementId: id, trackingMode });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to switch dispatch tracking mode';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
