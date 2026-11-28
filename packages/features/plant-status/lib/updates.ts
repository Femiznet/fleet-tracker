import { eq, sql } from 'drizzle-orm';
import { db, dbtx } from '@fleet/database';
import type { DbTransaction } from '@fleet/database';
import { plantStatus, skids } from '@fleet/database/schema';
import type { SkidYardUpdate, UpdatePlantStatusInput } from './validator';
import { formatPlantStatusMessage } from './format-message';
import { getDailyDispatchSummary } from './queries';
import { getLivePlantFleetSnapshot } from './snapshot';

export async function batchUpdateSkidYardStates(
  updates: SkidYardUpdate[],
  tx?: DbTransaction,
): Promise<void> {
  if (updates.length === 0) return;
  const conn = dbtx(tx);

  await Promise.all(
    updates.map((update) =>
      conn
        .update(skids)
        .set({
          ...(update.state !== undefined && { state: update.state }),
          ...(update.isForWashing !== undefined && {
            isForWashing: update.isForWashing,
          }),
        })
        .where(eq(skids.id, update.id)),
    ),
  );
}

export async function updateCurrentPlantStatus(input: UpdatePlantStatusInput) {
  const updated = await db.transaction(async (tx) => {
    if (input.skidUpdates && input.skidUpdates.length > 0) {
      await batchUpdateSkidYardStates(input.skidUpdates, tx);
    }

    const [savedStatus] = await tx
      .insert(plantStatus)
      .values({
        id: 1,
        officersOnDuty: input.officersOnDuty,
        metrics: input.metrics,
        notes: input.notes ?? null,
      })
      .onConflictDoUpdate({
        target: plantStatus.id,
        set: {
          officersOnDuty: input.officersOnDuty,
          metrics: sql`${plantStatus.metrics} || ${JSON.stringify(input.metrics)}::jsonb`,
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();

    const fleetSnapshot = await getLivePlantFleetSnapshot(tx);
    return { plantStatus: savedStatus, fleetSnapshot };
  });

  const formattedMessage = formatPlantStatusMessage(
    updated.plantStatus.officersOnDuty,
    updated.plantStatus.metrics,
    updated.fleetSnapshot,
  );

  return {
    plantStatus: updated.plantStatus,
    fleetSnapshot: updated.fleetSnapshot,
    formattedMessage,
  };
}

export async function updatePlantStatusReport(input: UpdatePlantStatusInput) {
  const dailyDispatchSummary = await getDailyDispatchSummary();
  const updated = await updateCurrentPlantStatus(input);

  return {
    plantStatus: updated.plantStatus,
    fleetSnapshot: updated.fleetSnapshot,
    dailyDispatchSummary,
    formattedMessage: updated.formattedMessage,
  };
}
