import { cancelMovement } from '@/services/dispatch';
import { apiErrorResponse } from '@/lib/api-errors';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    await cancelMovement({
      movementId: id,
      note: body.note ?? null,
    });

    return NextResponse.json({ movementId: id, status: 'cancelled' });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to cancel movement', 400);
  }
}
