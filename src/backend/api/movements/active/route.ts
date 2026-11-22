import { apiDbError, apiSuccess } from '@/backend/lib/api-response';
import { listActiveMovements } from '@/backend/services/movements/repository';

export async function GET() {
  try {
    return apiSuccess(await listActiveMovements());
  } catch (error) {
    return apiDbError(error);
  }
}
