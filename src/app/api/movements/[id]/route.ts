import { NextRequest } from 'next/server';
import { apiDbError, apiError, apiSuccess } from '@/lib/api-response';
import { getMovementById } from '@/services/movements/repository';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const movement = await getMovementById(id);
    return movement
      ? apiSuccess(movement)
      : apiError({ code: 'NOT_FOUND', message: 'Movement not found' }, 404);
  } catch (error) {
    return apiDbError(error);
  }
}
