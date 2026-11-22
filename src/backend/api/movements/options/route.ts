import { apiDbError, apiSuccess } from '@/backend/lib/api-response';
import { getMovementOptions } from '@/backend/services/movements/repository';

export async function GET() {
  try {
    return apiSuccess(await getMovementOptions());
  } catch (error) {
    return apiDbError(error);
  }
}
