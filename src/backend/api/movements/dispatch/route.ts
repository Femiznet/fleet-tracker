import { z } from 'zod';
import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/backend/lib/api-response';
import { createDirectDispatch } from '@/backend/services/dispatch';

const requestSchema = z.object({
  truckId: z.string().uuid(),
  customerId: z.string().uuid(),
  skidIdOut: z.string().uuid(),
  note: z.string().trim().max(2000).nullable().optional(),
  forceOverride: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return apiError(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid dispatch details',
          details: parsed.error.flatten(),
        },
        400
      );
    }

    const result = await createDirectDispatch({
      ...parsed.data,
      note: parsed.data.note ?? null,
    });
    return apiSuccess(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create dispatch';
    const requiresOverride = message.includes('Use manual override');

    return apiError(
      {
        code: requiresOverride ? 'OVERRIDE_REQUIRED' : 'MOVEMENT_FAILED',
        message,
        field: requiresOverride ? 'forceOverride' : undefined,
      },
      requiresOverride ? 409 : 400
    );
  }
}
