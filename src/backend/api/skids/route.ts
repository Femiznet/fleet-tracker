import { NextRequest } from 'next/server';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';
import { getPagination, getPaginationMeta } from '@/backend/lib/pagination';
import { createSkid, listSkids } from '@/backend/services/skids/repository';
import { createSkidSchema } from '@/backend/services/schema/validators';

export async function GET(request: NextRequest) {
  try {
    const pagination = getPagination(request.nextUrl.searchParams);
    const search = request.nextUrl.searchParams.get('search')?.trim() || undefined;
    const result = await listSkids(pagination.page, pagination.limit, search);
    return apiSuccess(result.rows, {
      pagination: getPaginationMeta(pagination.page, pagination.limit, result.total),
    });
  } catch (error) {
    return apiDbError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = createSkidSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError(
        { code: 'VALIDATION_ERROR', message: 'Invalid skid data', details: parsed.error.flatten() },
        400
      );
    }
    if (
      (parsed.data.owner === 'customer' || parsed.data.customerId) &&
      parsed.data.currentLoc !== 'pending'
    ) {
      return apiError(
        {
          code: 'CUSTOMER_SKID_LOCATION_UNTRACKED',
          message: 'Customer skid locations are not tracked and must remain pending.',
        },
        400
      );
    }
    return apiSuccess(await createSkid(parsed.data), { status: 201 });
  } catch (error) {
    return apiDbError(error);
  }
}
