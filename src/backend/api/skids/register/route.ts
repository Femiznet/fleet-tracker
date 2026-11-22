import { NextRequest } from 'next/server';
import { apiDbError, apiError, apiSuccess } from '@/backend/lib/api-response';
import { registerSkidsSchema } from '@/backend/services/schema/validators';
import { registerSkids, SkidRegistrationError } from '@/backend/services/skids/registration';

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: string; cause?: { code?: string } };
  return value.code === '23505' || value.cause?.code === '23505';
}

export async function POST(request: NextRequest) {
  try {
    const parsed = registerSkidsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid skid registration',
          details: parsed.error.flatten(),
        },
        400
      );
    }

    return apiSuccess(await registerSkids(parsed.data), { status: 201 });
  } catch (error) {
    if (error instanceof SkidRegistrationError) {
      return apiError(
        { code: error.code, message: error.message },
        error.code === 'CUSTOMER_NOT_FOUND' ? 404 : 409
      );
    }
    if (isUniqueViolation(error)) {
      return apiError(
        { code: 'DUPLICATE_SKID', message: 'A skid number or slug is already registered.' },
        409
      );
    }
    return apiDbError(error);
  }
}
