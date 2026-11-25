import { plantReports, skids } from "@/db/schema";
import { formatPlantReportMessage, getLivePlantFleetSnapshot } from "./report";
import { db } from "@/db";
import { PlantReportMetrics } from "@/db/schema/plant-report";
import { eq } from "drizzle-orm";

export interface SkidYardUpdate {
    id: string;
    state?: 'empty' | 'loading' | 'loaded' | 'on_hold';
    isForWashing?: boolean;
};
  
  /**
   * Helper: Batch-update the state of multiple skids at once
   */
  export async function batchUpdateSkidYardStates(
    updates: SkidYardUpdate[],
    tx: typeof db = db
  ): Promise<void> {
    if (updates.length === 0) return;
  
    await Promise.all(
      updates.map((u) =>
        tx
          .update(skids)
          .set({
            ...(u.state !== undefined && { state: u.state }),
            ...(u.isForWashing !== undefined && {
              isForWashing: u.isForWashing,
            }),
          })
          .where(eq(skids.id, u.id))
      )
    );
  }
  
  /**
   * Combined Hourly Flow:
   * 1. Updates all modified skid yard states
   * 2. Captures the fresh live fleet snapshot
   * 3. Saves the plant report and returns both the saved row & WhatsApp text
   */
  export async function submitHourlyPlantReport(input: {
    officersOnDuty: string;
    metrics: PlantReportMetrics;
    skidUpdates?: SkidYardUpdate[];
    notes?: string;
  }) {
    const report = await db.transaction(async (tx) => {
      // 1. Apply any skid changes from the hourly yard walk first
      if (input.skidUpdates && input.skidUpdates.length > 0) {
        await batchUpdateSkidYardStates(input.skidUpdates, tx as unknown as typeof db);
      }
  
      // 2. Capture the fresh snapshot reflecting those updates
      const fleetSnapshot = await getLivePlantFleetSnapshot();
  
      // 3. Insert the new plant report
      const [savedReport] = await tx
        .insert(plantReports)
        .values({
          officersOnDuty: input.officersOnDuty,
          metrics: input.metrics,
          fleetSnapshot,
          notes: input.notes ?? null,
        })
        .returning();
  
      return savedReport;
    });
  
    // 4. Format the ready-to-copy WhatsApp status message
    const formattedMessage = formatPlantReportMessage(
      report.officersOnDuty,
      report.metrics,
      report.fleetSnapshot!
    );
  
    return { report, formattedMessage };
  }
  