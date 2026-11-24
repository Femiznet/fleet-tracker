import { manualDispatchAction } from '@/services/dispatch';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'A manual dispatch action is required' }, { status: 400 });
    }

    const action = body.action;
    if (
      action !== 'arrived_customer' &&
      action !== 'returning' &&
      action !== 'arrived_plant'
    ) {
      return NextResponse.json(
        { error: 'action must be arrived_customer, returning, or arrived_plant' },
        { status: 400 }
      );
    }

    await manualDispatchAction({
      movementId: id,
      action,
      skidIdIn: typeof body.skidIdIn === 'string' ? body.skidIdIn : null,
      note: typeof body.note === 'string' ? body.note : null,
    });

    return NextResponse.json({ movementId: id, action });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to update manual dispatch';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
