import { NextRequest } from 'next/server';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';
import { deleteSkid, getSkidById, updateSkid } from '@/backend/services/skids/repository';
import { updateSkidSchema } from '@/backend/services/schema/validators';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const skid = await getSkidById(id);
    return skid ? apiSuccess(skid) : apiError({ code: 'NOT_FOUND', message: 'Skid not found' }, 404);
  } catch (error) {
    return apiDbError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const parsed = updateSkidSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Invalid skid data', details: parsed.error.flatten() }, 400);
    }
    const { id } = await params;
    const skid = await updateSkid(id, parsed.data);
    return skid ? apiSuccess(skid) : apiError({ code: 'NOT_FOUND', message: 'Skid not found' }, 404);
  } catch (error) {
    return apiDbError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const skid = await deleteSkid(id);
    return skid ? apiSuccess(skid) : apiError({ code: 'NOT_FOUND', message: 'Skid not found' }, 404);
  } catch (error) {
    return apiDbError(error);
  }
}
