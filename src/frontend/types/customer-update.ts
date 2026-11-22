import { z } from 'zod';
import { PaginationMetaSchema } from './dispatch-review';

const SkidListSchema = z.union([z.string(), z.array(z.string())]).nullable();

export const CustomerUpdateDataSchema = z.object({
  PRMS: z.array(z.object({
    id: z.number().int(),
    pressure: z.number().nullable(),
    flowrate: z.number().nullable(),
    totalflow: z.number().nullable(),
    skidinuse: SkidListSchema,
  })),
  outletpressure: z.number().nullable(),
  standbyskid: SkidListSchema,
  emptyskid: SkidListSchema,
  availabletrucks: z.union([z.number().int(), z.array(z.string())]).nullable(),
  reportedAt: z.string().nullable(),
});

export const CustomerUpdateMessageSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  text: z.string(),
  type: z.literal('update'),
  metadata: z.unknown(),
  createdAt: z.string().nullable(),
  isProcessed: z.boolean(),
  processingStatus: z.enum(['ok', 'needs_review', 'failed']).nullable(),
  warnings: z.array(z.string()).nullable(),
  parsedData: CustomerUpdateDataSchema.nullable(),
  reviewStatus: z.string().nullable(),
  duplicateOfMessageId: z.string().nullable(),
  movementId: z.string().nullable(),
});

export const CustomerUpdatesResponseSchema = z.object({
  data: z.array(CustomerUpdateMessageSchema),
  meta: z.object({ pagination: PaginationMetaSchema }).optional(),
});

export const ForecastStatusSchema = z.enum(['estimated', 'needs_review', 'unavailable']);

export const CustomerForecastSchema = z.object({
  messageId: z.string(),
  receivedAt: z.string().datetime().nullable(),
  reportedAt: z.string().nullable(),
  parseStatus: z.enum(['ok', 'needs_review', 'failed']),
  warnings: z.array(z.string()),
  prmsForecasts: z.array(z.object({
    prmsId: z.number().int(),
    skidNumbers: z.array(z.string()),
    pressureBar: z.number().nullable(),
    flowRateScmPerHour: z.number().nullable(),
    estimatedHoursRemaining: z.number().nullable(),
    estimatedTimeRemaining: z.string().nullable(),
    status: ForecastStatusSchema,
    warnings: z.array(z.string()),
  })),
});

export const CustomerForecastResponseSchema = z.object({
  data: CustomerForecastSchema.nullable(),
});

export type CustomerUpdateData = z.infer<typeof CustomerUpdateDataSchema>;
export type CustomerUpdateMessage = z.infer<typeof CustomerUpdateMessageSchema>;
export type CustomerForecast = z.infer<typeof CustomerForecastSchema>;
