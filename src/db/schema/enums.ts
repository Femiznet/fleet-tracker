import { pgEnum } from 'drizzle-orm/pg-core';

export const customerType = pgEnum('customer_type', ['waybill', 'meter', 'self-pick']);
export const processingStatus = pgEnum('processing_status', ['needs review', 'pending', 'failed', 'processed']);
export const tripDirectionEnum = pgEnum('direction', ['outbound', 'inbound']);
export const movementTypeEnum = pgEnum('movement_type', ['dispatch', 'service', 'others', 'pickup']);
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

export const truckStatusEnum = pgEnum('truck_status', [
  'available',
  'in_transit',
  'standby',
  'at_customer',
  'maintenance',
]);

export const skidStatusEnum = pgEnum('skid_status', [
  'available',
  'in_transit',
  'at_customer',
  'maintenance',
]);

export const skidFillStateEnum = pgEnum('skid_fill_state', [
  'empty',
  'loading',
  'loaded',
]);

export const skidBayStateEnum = pgEnum('skid_bay_state', [
  'idle',
  'on_hold',
  'washing',
]);
