// db/schema.ts
import { pgTable, text, doublePrecision, jsonb, timestamp, uuid } from 'drizzle-orm/pg-core';

export const geofenceZones = pgTable('geofence_zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Exact name returned by your API (e.g., "GASTECH PLANT")
  geofenceName: text('geofence_name').unique(),
  // Null until the first truck visits and teaches the system the coordinates
  centerLat: doublePrecision('center_lat'),
  centerLon: doublePrecision('center_lon'),
  radiusMeters: doublePrecision('radius_meters'),

  // Stores confirmed points inside this zone to refine the center & radius
  samplePoints: jsonb('sample_points')
    .$type<{ lat: number; lon: number }[]>()
    .notNull()
    .default([]),

  updatedAt: timestamp('updated_at').defaultNow(),
});
