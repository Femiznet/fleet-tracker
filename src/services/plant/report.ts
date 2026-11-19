import { eq, and, or, inArray, sql } from 'drizzle-orm';
import { db, dbtx, DbTransaction } from '@/db'; // adjust import to where dbtx/DbTransaction live
import { trucks } from '@/db/schema/trucks';
import { skids } from '@/db/schema/skids';
import { movements } from '@/db/schema/movements';
import { trips } from '@/db/schema/trips';
import { customers } from '@/db/schema/customers';
import {
  plantReports,
  PlantReportMetrics,
  PlantFleetSnapshot,
} from '@/db/schema/plant-report';

export interface SkidYardUpdate {
    id: string;
    fillState?: 'empty' | 'loading' | 'loaded';
    bayState?: 'idle' | 'on_hold' | 'washing';
}
  

export async function getLivePlantFleetSnapshot(
  tx?: DbTransaction
): Promise<PlantFleetSnapshot> {
  const conn = dbtx(tx);

  const [allSkids, allTrucks, activeMovements] = await Promise.all([
    conn
      .select({
        skidNum: skids.skidNum,
        status: skids.status,
        fillState: skids.fillState,
        bayState: skids.bayState,
        isNew: skids.isNew,
        customerName: customers.name,
      })
      .from(skids)
      .leftJoin(customers, eq(skids.customerId, customers.id))
      .where(
        or(
          eq(skids.status, 'maintenance'),
          and(
            eq(skids.status, 'available'),
            sql`TRIM(${skids.currentLoc}) = 'GASTECH PLANT'`
          )
        )
      ),

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
    
  // Categorize Skids
  for (const s of allSkids) {
    const label = s.customerName ? `${s.skidNum}(${s.customerName})` : s.skidNum;

    if (s.status === 'maintenance') {
      snapshot.maintenance.skids.push(label);
      continue;
    }

    if (s.bayState === 'on_hold') {
      snapshot.skidsOnHold.push(label);
    } else if (s.bayState === 'washing') {
      snapshot.skidsForWashing.push({
        skidNum: label,
        fillState: s.fillState,
      });
    } else if (s.isNew && s.fillState === 'loaded') {
      snapshot.newLoadedSkids.push(label);
    } else if (s.fillState === 'loading') {
      if (s.customerName) snapshot.skidsLoading.customer.push(label);
      else snapshot.skidsLoading.gastech.push(s.skidNum);
    } else if (s.fillState === 'loaded') {
      if (s.customerName) snapshot.skidsLoaded.customer.push(label);
      else snapshot.skidsLoaded.gastech.push(s.skidNum);
    } else if (s.fillState === 'empty') {
      if (s.customerName) snapshot.skidsEmpty.customer.push(label);
      else snapshot.skidsEmpty.gastech.push(s.skidNum);
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
      snapshot.returningTrucks.push(m.truckNum);
    } else {
      snapshot.trucksInTransit.push({
        truckNum: m.truckNum,
        customer: m.customerName ?? 'Unknown',
      });
    }
  }

  return snapshot;
}


/**
 * 2. Save a shift Plant Report (combines manual officer metrics + frozen fleet snapshot)
 */
export async function createPlantReport(input: {
  officersOnDuty: string;
  metrics: PlantReportMetrics;
  notes?: string;
}) {
  const fleetSnapshot = await getLivePlantFleetSnapshot();

  const [report] = await db
    .insert(plantReports)
    .values({
      officersOnDuty: input.officersOnDuty,
      metrics: input.metrics,
      fleetSnapshot,
      notes: input.notes ?? null,
    })
    .returning();

  return report;
}

/**
 * 3. Format any saved or live report into your exact WhatsApp-ready text template
 */
export function formatPlantReportMessage(
  officersOnDuty: string,
  metrics: PlantReportMetrics,
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
    snapshot.returningTrucks.join(', '),
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
      .map((s, idx) => `${idx + 1}. ${s.skidNum} (${s.fillState})`)
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
            ...(u.fillState !== undefined && { fillState: u.fillState }),
            ...(u.bayState !== undefined && { bayState: u.bayState }),
          })
          .where(eq(skids.id, u.id))
      )
    );
  }
  
export async function submitHourlyPlantReport(input: {
    officersOnDuty: string;
    metrics: PlantReportMetrics;
    skidUpdates?: SkidYardUpdate[];
    notes?: string;
}) {
    const report = await db.transaction(async (tx) => {
      if (input.skidUpdates && input.skidUpdates.length > 0) {
        await batchUpdateSkidYardStates(input.skidUpdates, tx);
      }
  
      const fleetSnapshot = await getLivePlantFleetSnapshot(tx);
  
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
  
    const formattedMessage = formatPlantReportMessage(
      report.officersOnDuty,
      report.metrics,
      report.fleetSnapshot!
    );
  
    return { report, formattedMessage };
}
  
  