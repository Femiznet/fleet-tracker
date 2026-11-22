import { z } from 'zod';
import { PaginationMetaSchema } from './dispatch-review';

const SkidListSchema = z.union([z.string(), z.array(z.string())]).nullable();

export const CustomerUpdateDataSchema = z.object({
  PRMS: z.array(
    z.object({
      id: z.number().int(),
      pressure: z.number().nullable(),
      flowrate: z.number().nullable(),
      totalflow: z.number().nullable(),
      skidinuse: SkidListSchema,
    })
  ),
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
  prmsForecasts: z.array(
    z.object({
      prmsId: z.number().int(),
      skidNumbers: z.array(z.string()),
      pressureBar: z.number().nullable(),
      flowRateScmPerHour: z.number().nullable(),
      estimatedHoursRemaining: z.number().nullable(),
      estimatedTimeRemaining: z.string().nullable(),
      status: ForecastStatusSchema,
      warnings: z.array(z.string()),
    })
  ),
});

export const CustomerForecastResponseSchema = z.object({
  data: CustomerForecastSchema.nullable(),
});

export const CustomerUpdatePeriodSchema = z.enum(['24h', '7d', '30d']);
export const CustomerUpdateStatusFilterSchema = z.enum([
  'all',
  'pending',
  'ok',
  'needs_review',
  'failed',
]);

export const CustomerUpdateHistoryItemSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  text: z.string(),
  createdAt: z.string().nullable(),
  isProcessed: z.boolean(),
  processingStatus: z.enum(['ok', 'needs_review', 'failed']).nullable(),
  warnings: z.array(z.string()),
  parsedData: CustomerUpdateDataSchema.nullable(),
  forecast: CustomerForecastSchema.nullable(),
});

export const CustomerSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string().nullable(),
  isActive: z.boolean(),
  latestUpdate: z
    .object({
      messageId: z.string(),
      createdAt: z.string().nullable(),
      isProcessed: z.boolean(),
      processingStatus: z.enum(['pending', 'ok', 'needs_review', 'failed']).nullable(),
      warnings: z.array(z.string()),
      parsedData: CustomerUpdateDataSchema.nullable(),
      forecast: CustomerForecastSchema.nullable(),
    })
    .nullable(),
  latestFlowScmPerHour: z.number().nullable(),
  averagePressureBar: z.number().nullable(),
  estimatedRuntimeHours: z.number().nullable(),
});

export const CustomerUpdateTrendPointSchema = z.object({
  timestamp: z.string().datetime(),
  customerId: z.string(),
  customerName: z.string(),
  value: z.number(),
  status: z.enum(['ok', 'needs_review', 'failed']).nullable(),
});

export const CustomerUpdateRankingSchema = z.object({
  customerId: z.string(),
  customerName: z.string(),
  flowRateScmPerHour: z.number(),
  estimatedRuntimeHours: z.number().nullable(),
});

export const CustomerUpdateAnalyticsSchema = z.object({
  period: CustomerUpdatePeriodSchema,
  summary: z.object({
    activeCustomerCount: z.number(),
    totalUpdates: z.number(),
    combinedFlowScmPerHour: z.number(),
    averagePressureBar: z.number().nullable(),
    customersNeedingReview: z.number(),
    highestFlowCustomer: CustomerUpdateRankingSchema.nullable(),
    shortestRuntimeCustomer: z
      .object({
        customerId: z.string(),
        customerName: z.string(),
        estimatedRuntimeHours: z.number(),
      })
      .nullable(),
  }),
  customers: z.array(CustomerSummarySchema),
  pressureTrend: z.array(CustomerUpdateTrendPointSchema),
  flowTrend: z.array(CustomerUpdateTrendPointSchema),
  runtimeTrend: z.array(CustomerUpdateTrendPointSchema),
  flowRanking: z.array(CustomerUpdateRankingSchema),
  recentUpdates: z.array(CustomerUpdateHistoryItemSchema),
});

export const CustomerUpdateHistoryResponseSchema = z.object({
  data: z.array(CustomerUpdateHistoryItemSchema),
  meta: z.object({ pagination: PaginationMetaSchema }).optional(),
});

export const CustomerUpdateAnalyticsResponseSchema = z.object({
  data: CustomerUpdateAnalyticsSchema,
});

export type CustomerUpdateData = z.infer<typeof CustomerUpdateDataSchema>;
export type CustomerUpdateMessage = z.infer<typeof CustomerUpdateMessageSchema>;
export type CustomerForecast = z.infer<typeof CustomerForecastSchema>;
export type CustomerUpdatePeriod = z.infer<typeof CustomerUpdatePeriodSchema>;
export type CustomerUpdateStatusFilter = z.infer<typeof CustomerUpdateStatusFilterSchema>;
export type CustomerUpdateHistoryItem = z.infer<typeof CustomerUpdateHistoryItemSchema>;
export type CustomerSummary = z.infer<typeof CustomerSummarySchema>;
export type CustomerUpdateTrendPoint = z.infer<typeof CustomerUpdateTrendPointSchema>;
export type CustomerUpdateRanking = z.infer<typeof CustomerUpdateRankingSchema>;
export type CustomerUpdateAnalytics = z.infer<typeof CustomerUpdateAnalyticsSchema>;
