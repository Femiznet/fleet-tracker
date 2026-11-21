import { z } from 'zod';

export const ReviewStatusSchema = z.enum(['pending', 'duplicate', 'approved', 'rejected']);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const DispatchDetailsSchema = z.object({
  truckNumber: z.string().nullable(),
  skidNumber: z.string().nullable(),
  driverName: z.string().nullable(),
  customerName: z.string().nullable(),
  dateOut: z.string().nullable(),
  timeOut: z.string().nullable(),
  driverContact: z.string().nullable(),
});
export type DispatchDetails = z.infer<typeof DispatchDetailsSchema>;

export const DispatchMessageSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  text: z.string(),
  type: z.literal('dispatch'),
  metadata: z.unknown(),
  createdAt: z.string().nullable(),
  isProcessed: z.boolean(),
  processingStatus: z.string().nullable(),
  warnings: z.array(z.string()).nullable(),
  parsedData: DispatchDetailsSchema.nullable(),
  reviewStatus: ReviewStatusSchema.nullable(),
  duplicateOfMessageId: z.string().nullable(),
  movementId: z.string().nullable(),
});
export type DispatchMessage = z.infer<typeof DispatchMessageSchema>;

export const DispatchNotificationSchema = z.object({
  messageId: z.string(),
  movementId: z.string().nullable(),
  customerId: z.string(),
  customerName: z.string(),
  notificationText: z.string().nullable(),
  approvedAt: z.string().nullable(),
  dueAt: z.string().nullable(),
  overdue: z.boolean(),
});
export type DispatchNotification = z.infer<typeof DispatchNotificationSchema>;

export const PaginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
});
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
