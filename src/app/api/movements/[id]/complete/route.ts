import { completeMovement } from '@/services/dispatch';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    await completeMovement({
      movementId: id,
      skidIdIn: body.skidIdIn ?? null,
      note: body.note ?? null,
      forceOverride: Boolean(body.forceOverride),
    });

    return NextResponse.json({ movementId: id, status: 'completed' });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to complete movement';
    const requiresOverride = message.includes('manual override');

    return NextResponse.json(
      { error: message, requiresOverride },
      { status: requiresOverride ? 409 : 400 }
    );
  }
}
