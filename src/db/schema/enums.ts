import { pgEnum } from 'drizzle-orm/pg-core';

export const customerType = pgEnum('customer_type', ['waybill', 'meter', 'self-pick']);
export const processingStatus = pgEnum('processing_status', ['needs review', 'pending', 'failed', 'processed']);
export const direction = pgEnum('direction', ['outbound', 'inbound']);
