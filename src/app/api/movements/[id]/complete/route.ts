import { completeMovement } from '@/services/dispatch';
import { apiErrorResponse } from '@/lib/api-errors';
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
      skidInState: body.skidInState,
    });

    return NextResponse.json({ movementId: id, status: 'completed' });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to complete movement', 400);
  }
}
