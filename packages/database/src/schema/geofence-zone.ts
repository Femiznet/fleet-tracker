import {
  doublePrecision,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { geofenceZoneType } from './enums';

export const geofenceZones = pgTable('geofence_zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  geofenceName: text('geofence_name').unique(),
  type: geofenceZoneType('type').notNull().default('other'),
  centerLat: doublePrecision('center_lat'),
  centerLon: doublePrecision('center_lon'),
  radiusMeters: doublePrecision('radius_meters'),
  samplePoints: jsonb('sample_points')
    .$type<{ lat: number; lon: number }[]>()
    .notNull()
    .default([]),
  updatedAt: timestamp('updated_at').defaultNow(),
});
