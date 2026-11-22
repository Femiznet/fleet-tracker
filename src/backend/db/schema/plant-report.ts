import { pgTable, uuid, varchar, timestamp, jsonb, text } from 'drizzle-orm/pg-core';

// Flexible metrics entered by the officer on duty (can evolve anytime without DB migrations)
export interface PlantReportMetrics {
  inletPressureBar?: number; // e.g. 13.1
  loadingPressureBar?: number; // e.g. 190
  landingGearBox?: {
    loadingAndWashingBay?: number; // e.g. 52
    workshop?: number; // e.g. 29
    wooden?: number; // e.g. 2
  };
  newChassisInPlant?: number; // e.g. 12
  compressors?: Record<string, string>; // e.g. { "COMP 1": "On", "COMP 3": "On (NGV)" }
  extraFields?: Record<string, string | number>; // Any brand-new ad-hoc field!
}

// Auto-captured snapshot of live fleet & skid states at the time the report is submitted
export interface PlantFleetSnapshot {
  skidsLoading: { customer: string[]; gastech: string[] };
  skidsOnHold: string[];
  skidsLoaded: { customer: string[]; gastech: string[] };
  skidsEmpty: { customer: string[]; gastech: string[] };
  newLoadedSkids: string[];
  skidsForWashing: { skidNum: string; fillState: string }[];
  trucksOnGround: string[];
  standbyTrucks: string[];
  trucksInTransit: { truckNum: string; customer: string }[];
  returningTrucks: string[];
  maintenance: { skids: string[]; trucks: string[] };
}

export const plantReports = pgTable('plant_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  shiftDate: timestamp('shift_date').defaultNow().notNull(),
  officersOnDuty: varchar('officers_on_duty', { length: 255 }).notNull(),
  metrics: jsonb('metrics').$type<PlantReportMetrics>().notNull(),
  fleetSnapshot: jsonb('fleet_snapshot').$type<PlantFleetSnapshot>(), // Frozen point-in-time fleet state
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type PlantReport = typeof plantReports.$inferSelect;
export type NewPlantReport = typeof plantReports.$inferInsert;
