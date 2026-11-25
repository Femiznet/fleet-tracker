import {
  and,
  count,
  countDistinct,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm';
import { db, dbtx } from '@/db';
import type { DbTransaction } from '@/db';
import { trucks } from '@/db/schema/trucks';
import { skids } from '@/db/schema/skids';
import { movements } from '@/db/schema/movements';
import { trips } from '@/db/schema/trips';
import { customers } from '@/db/schema/customers';
import { customerSkidVisits } from '@/db/schema/customer-skid-visit';
import { plantStatus } from '@/db/schema/plant-status';
import type {
  PlantFleetSnapshot,
  PlantStatusMetrics,
} from '@/db/schema/plant-status';
import type {
  SkidYardUpdate,
  UpdatePlantStatusInput,
} from './validator';

export async function getLivePlantFleetSnapshot(
  tx?: DbTransaction
): Promise<PlantFleetSnapshot> {
  const conn = dbtx(tx);

  const [allSkids, customerVisits, allTrucks, activeMovements] = await Promise.all([
    conn
      .select({
        skidNum: skids.skidNum,
        status: skids.status,
        state: skids.state,
        isForWashing: skids.isForWashing,
        isNew: skids.isNew,
      })
      .from(skids)
      .where(
        and(
          isNull(skids.customerId),
          or(
            eq(skids.status, 'maintenance'),
            and(
              eq(skids.status, 'available'),
              sql`TRIM(${skids.currentLoc}) = 'GASTECH PLANT'`
            )
          )
        )
      ),

    conn
      .select({
        skidNum: customerSkidVisits.skidNum,
        state: customerSkidVisits.state,
        isForWashing: customerSkidVisits.isForWashing,
        customerName: customers.name,
      })
      .from(customerSkidVisits)
      .innerJoin(customers, eq(customerSkidVisits.customerId, customers.id))
      .where(isNull(customerSkidVisits.dispatchedAt)),

    conn
      .select({
        id: trucks.id,
        truckNum: trucks.truckNum,
        status: trucks.status,
        currentLoc: trucks.currentLoc,
      })
      .from(trucks)
      .where(inArray(trucks.status, ['available', 'standby', 'maintenance'])),

    conn
      .select({
        truckNum: trucks.truckNum,
        customerName: customers.name,
        tripDirection: trips.direction,
        tripStatus: trips.status,
      })
      .from(movements)
      .innerJoin(trucks, eq(movements.truckId, trucks.id))
      .leftJoin(customers, eq(movements.customerId, customers.id))
      .leftJoin(
        trips,
        and(eq(trips.movementId, movements.id), eq(trips.status, 'in_transit'))
      )
      .where(eq(movements.status, 'in_progress')),
  ]);

  const snapshot: PlantFleetSnapshot = {
    skidsLoading: { customer: [], gastech: [] },
    skidsOnHold: [],
    skidsLoaded: { customer: [], gastech: [] },
    skidsEmpty: { customer: [], gastech: [] },
    newLoadedSkids: [],
    skidsForWashing: [],
    trucksOnGround: [],
    standbyTrucks: [],
    trucksInTransit: [],
    returningTrucks: [],
    maintenance: { skids: [], trucks: [] },
    };
    
    for (const visit of customerVisits) {
      const label = `${visit.skidNum}(${visit.customerName})`;
      if (visit.state === 'on_hold') {
        snapshot.skidsOnHold.push(label);
      } else if (visit.isForWashing) {
        snapshot.skidsForWashing.push({
          skidNum: label,
          state: visit.state,
        });
      } else if (visit.state === 'loading') {
        snapshot.skidsLoading.customer.push(label);
      } else if (visit.state === 'loaded') {
        snapshot.skidsLoaded.customer.push(label);
      } else {
        snapshot.skidsEmpty.customer.push(label);
      }
    }

  // Categorize Skids
  for (const s of allSkids) {
    const label = s.skidNum;

    if (s.status === 'maintenance') {
      snapshot.maintenance.skids.push(label);
      continue;
    }

    if (s.state === 'on_hold') {
      snapshot.skidsOnHold.push(label);
    } else if (s.isForWashing) {
      snapshot.skidsForWashing.push({
        skidNum: label,
        state: s.state,
      });
    } else if (s.isNew && s.state === 'loaded') {
      snapshot.newLoadedSkids.push(label);
    } else if (s.state === 'loading') {
      snapshot.skidsLoading.gastech.push(s.skidNum);
    } else if (s.state === 'loaded') {
      snapshot.skidsLoaded.gastech.push(s.skidNum);
    } else if (s.state === 'empty') {
      snapshot.skidsEmpty.gastech.push(s.skidNum);
    }
  }

  // Categorize Trucks
  for (const t of allTrucks) {
    if (t.status === 'maintenance') {
      snapshot.maintenance.trucks.push(t.truckNum);
    } else if (t.status === 'standby') {
      snapshot.standbyTrucks.push(t.truckNum);
    } else if (t.status === 'available' && t.currentLoc.trim() === 'GASTECH PLANT') {
      snapshot.trucksOnGround.push(t.truckNum);
    }
  }

  // Categorize Active Trips (Outbound = Trucks in Transit, Inbound = Returning Trucks)
  for (const m of activeMovements) {
    if (m.tripDirection === 'inbound') {
      snapshot.returningTrucks.push({
        truckNum: m.truckNum,
        customer: m.customerName ?? 'Unknown',
      })
    } else if (m.tripDirection === 'outbound'){
      snapshot.trucksInTransit.push({
        truckNum: m.truckNum,
        customer: m.customerName ?? 'Unknown',
      });
    }
  }

  return snapshot;
}


export async function getCurrentPlantStatus() {
  const [status] = await db
    .select()
    .from(plantStatus)
    .where(eq(plantStatus.id, 1))
    .limit(1);

  return status ?? null;
}

export async function getDailyDispatchSummary(date?: string) {
  const dayStart = date
    ? sql`${date}::date::timestamp AT TIME ZONE 'Africa/Lagos'`
    : sql`date_trunc('day', now() AT TIME ZONE 'Africa/Lagos') AT TIME ZONE 'Africa/Lagos'`;
  const dayEnd = sql`${dayStart} + interval '1 day'`;
  const [customerCounts, [companyCounts]] = await Promise.all([
    db
      .select({
        skidsDispatched: count(),
        customersServed: countDistinct(customerSkidVisits.customerId),
      })
      .from(customerSkidVisits)
      .where(
        and(
          gte(customerSkidVisits.dispatchedAt, dayStart),
          lt(customerSkidVisits.dispatchedAt, dayEnd)
        )
      ),
    db
      .select({ skidsDispatched: count() })
      .from(trips)
      .innerJoin(movements, eq(trips.movementId, movements.id))
      .where(
        and(
          eq(movements.type, 'dispatch'),
          eq(trips.direction, 'outbound'),
          eq(trips.status, 'arrived'),
          gte(trips.arrivedAt, dayStart),
          lt(trips.arrivedAt, dayEnd)
        )
      ),
  ]);
  const customerSkidsDispatched = customerCounts[0]?.skidsDispatched ?? 0;
  const companySkidsDispatched = companyCounts?.skidsDispatched ?? 0;

  return {
    date:
      date ??
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Lagos',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
    customersServed: customerCounts[0]?.customersServed ?? 0,
    customerSkidsDispatched,
    companySkidsDispatched,
    totalSkidsDispatched: customerSkidsDispatched + companySkidsDispatched,
  };
}

/**
 * Format the current plant status as WhatsApp-ready text.
 */
export function formatPlantStatusMessage(
  officersOnDuty: string,
  metrics: PlantStatusMetrics,
  snapshot: PlantFleetSnapshot
): string {
  const bay = metrics.landingGearBox?.loadingAndWashingBay ?? 0;
  const workshop = metrics.landingGearBox?.workshop ?? 0;
  const wooden = metrics.landingGearBox?.wooden ?? 0;
  const baseTotal = bay + workshop;
  const grandTotal = baseTotal + wooden;

  const compressorLines = metrics.compressors
    ? Object.entries(metrics.compressors)
        .map(([name, state]) => `*[${name}]*: ${state}`)
        .join('\n')
    : '';

  const extraLines = metrics.extraFields
    ? Object.entries(metrics.extraFields)
        .map(([key, val]) => `*${key.toUpperCase()}*: ${val}`)
        .join('\n')
    : '';

  return [
    '`PLANT STATUS`',
    '',
    `*INLET PRESSURE*: ${metrics.inletPressureBar ?? '-'} bar`,
    '',
    `\`SKIDS LOADING AT\` ${metrics.loadingPressureBar ?? 190} BAR`,
    '',
    '*[Customer Skid]*:',
    snapshot.skidsLoading.customer.join(', '),
    '',
    '*[Gastech Skid]*:',
    snapshot.skidsLoading.gastech.join(', '),
    '',
    '*[On Hold]*:',
    snapshot.skidsOnHold.join(', '),
    '',
    '`SKIDS LOADED`',
    '',
    '*[Customer Skid]*:',
    snapshot.skidsLoaded.customer.join(', '),
    '',
    '*[Gastech Skid]*:',
    snapshot.skidsLoaded.gastech.join(', '),
    '',
    '`SKIDS EMPTY`',
    '',
    '*[Customer Skid]*:',
    snapshot.skidsEmpty.customer.join(', '),
    '',
    '*[Gastech skid]*:',
    snapshot.skidsEmpty.gastech.join(', '),
    '',
    '`NEW LOADED SKIDS`',
    snapshot.newLoadedSkids.join(', '),
    '',
    '`TRUCKS ON GROUND`',
    snapshot.trucksOnGround.join(', '),
    '',
    '`STANDBY TRUCKS (NO DRIVERS)`',
    snapshot.standbyTrucks.join(', '),
    '',
    '`TRUCKS IN TRANSIT`',
    snapshot.trucksInTransit.map((t) => `${t.truckNum}(${t.customer})`).join('\n'),
    '',
    '`RETURNING TRUCKS`',
    snapshot.returningTrucks.map((t) => `${t.truckNum}(${t.customer})`).join('\n'),
    '',
    '`MAINTENANCE`',
    '',
    '*[SKIDS]*:',
    snapshot.maintenance.skids.join(', '),
    '',
    '*[TRUCKS]*:',
    snapshot.maintenance.trucks.join(', '),
    '',
    '`SKIDS FOR WASHING`',
    snapshot.skidsForWashing
      .map((s, idx) => {
        const state = s.state;
        return `${idx + 1}. ${s.skidNum}(${state})`;
      })
      .join('\n'),
    '',
    '`LANDING GEAR BOX`',
    '',
    `*[LANDING GEARBOX AT LOADING BAY & WASHING BAY]*: ${bay}`,
    '',
    `*[LANDING GEARBOX AT WORKSHOP]*: ${workshop}pcs`,
    '',
    `*[Total landing gearbox]*: ${baseTotal} + (${wooden}) wooden. Grand total = ${grandTotal}`,
    '',
    `*Total new chassis in plant*: ${metrics.newChassisInPlant ?? 0}`,
    '',
    '`WORKING COMPRESSORS`',
    '',
    compressorLines,
    extraLines ? `\n${extraLines}` : '',
    '',
    '*LOGISTICS OFFICER ON DUTY*:',
    `\`${officersOnDuty.toUpperCase()}\``,
  ]
    .join('\n')
    .trim();
}


export async function batchUpdateSkidYardStates(
    updates: SkidYardUpdate[],
    tx?: DbTransaction
  ): Promise<void> {
    if (updates.length === 0) return;
    const conn = dbtx(tx);
  
    await Promise.all(
      updates.map((u) =>
        conn
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
  
export async function updateCurrentPlantStatus(
  input: UpdatePlantStatusInput
) {
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
      updated.fleetSnapshot
    );
  
    return {
      plantStatus: updated.plantStatus,
      fleetSnapshot: updated.fleetSnapshot,
      formattedMessage,
    };
}
  
  