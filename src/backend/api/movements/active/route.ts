import { NextRequest } from 'next/server';
import { apiDbError, apiSuccess } from '@/backend/lib/api-response';
import { listActiveMovements } from '@/backend/services/movements/repository';

export async function GET(_request: NextRequest) {
  try {
    return apiSuccess(await listActiveMovements());
  } catch (error) {
    return apiDbError(error);
  }
}
