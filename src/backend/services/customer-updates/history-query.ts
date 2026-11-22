import { z } from 'zod';
import type { CustomerUpdateStatusFilter } from './analytics';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });

const querySchema = z
  .object({
    customerId: z.string().uuid().optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    status: z.enum(['all', 'pending', 'ok', 'needs_review', 'failed']).default('all'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .refine((query) => query.from === undefined || query.to === undefined || query.from <= query.to, {
    path: ['to'],
    message: 'End date must be on or after start date',
  });

export function parseCustomerUpdateHistoryQuery(params: URLSearchParams) {
  const parsed = querySchema.safeParse({
    customerId: params.get('customerId') ?? undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    status: params.get('status') ?? 'all',
    page: params.get('page') ?? '1',
    limit: params.get('limit') ?? '25',
  });
  if (!parsed.success) {
    return {
      success: false as const,
      message: parsed.error.issues[0]?.message ?? 'Invalid customer update history filters',
    };
  }

  const from = parsed.data.from ? new Date(`${parsed.data.from}T00:00:00.000Z`) : undefined;
  const toExclusive = parsed.data.to
    ? new Date(new Date(`${parsed.data.to}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000)
    : undefined;

  return {
    success: true as const,
    data: {
      ...parsed.data,
      status: parsed.data.status as CustomerUpdateStatusFilter,
      from,
      toExclusive,
    },
  };
}
