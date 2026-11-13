import { pgEnum } from 'drizzle-orm/pg-core';

export const customerType = pgEnum('customer_type', ['waybill', 'meter', 'self-pick']);
export const processingStatus = pgEnum('processing_status', ['needs review', 'pending', 'failed', 'processed']);
export const tripDirectionEnum = pgEnum('direction', ['outbound', 'inbound']);
export const movementTypeEnum = pgEnum('movement_type', ['dispatch', 'service', 'others']);
export const movementStatusEnum = pgEnum('movement_status', [
    'in_progress',
    'completed',
    'cancelled',
]);
export const tripStatusEnum = pgEnum('trip_status', [
    'in_transit',
    'arrived',
    'cancelled',
]);
