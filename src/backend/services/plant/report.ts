import { eq, and, or, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, dbtx, DbTransaction } from '@/backend/db';
import { trucks } from '@/backend/db/schema/trucks';
import { skids } from '@/backend/db/schema/skids';
import { plantSkidStatuses } from '@/backend/db/schema/plant-skid-status';
import { plantTruckStatuses } from '@/backend/db/schema/plant-truck-status';
import { movements } from '@/backend/db/schema/movements';
import { trips } from '@/backend/db/schema/trips';
import { customers } from '@/backend/db/schema/customers';
import { drivers } from '@/backend/db/schema/drivers';
import {
  plantReports,
  PlantReportMetrics,
  PlantFleetSnapshot,
} from '@/backend/db/schema/plant-report';
import { plantDisplayNumber } from './identifiers';

export interface SkidYardUpdate {
  id: string;
  fillState?: 'empty' | 'loading' | 'loaded' | 'on_hold';
  bay?: 'washing_bay' | 'loading_bay' | 'parking_bay';
  isOnMaintenance?: boolean;
  maintenanceNote?: string | null;
  note?: string | null;
}

export async function getLivePlantFleetSnapshot(tx?: DbTransaction): Promise<PlantFleetSnapshot> {
  const conn = dbtx(tx);
  const outboundTrips = alias(trips, 'plant_outbound_trips');
  const inboundTrips = alias(trips, 'plant_inbound_trips');

  const [allSkids, allTrucks, activeMovements] = await Promise.all([
    conn
      .select({
        skidId: skids.id,
        skidNum: skids.skidNum,
        slugNum: skids.slugNum,
        status: skids.status,
        fillState: plantSkidStatuses.fillState,
        bay: plantSkidStatuses.bay,
        isNew: skids.isNew,
        owner: skids.owner,
        isOnMaintenance: plantSkidStatuses.isOnMaintenance,
        maintenanceNote: plantSkidStatuses.maintenanceNote,
        customerName: customers.name,
        note: plantSkidStatuses.note,
      })
      .from(skids)
      .leftJoin(customers, eq(skids.customerId, customers.id))
      .leftJoin(plantSkidStatuses, eq(plantSkidStatuses.skidId, skids.id))
      .where(
        or(
          and(eq(skids.owner, 'gastech'), eq(plantSkidStatuses.isOnMaintenance, true)),
          and(eq(skids.status, 'available'), sql`TRIM(${skids.currentLoc}) = 'GASTECH PLANT'`)
        )
      ),

    conn
      .select({
        id: trucks.id,
        truckNum: trucks.truckNum,
        slugNum: trucks.slugNum,
        status: trucks.status,
        isOnMaintenance: plantTruckStatuses.isOnMaintenance,
        isStandby: plantTruckStatuses.isStandby,
        maintenanceNote: plantTruckStatuses.maintenanceNote,
        currentLoc: trucks.currentLoc,
        note: trucks.note,
        assignedDriver: drivers.name,
      })
      .from(trucks)
      .leftJoin(drivers, eq(drivers.currentTruck, trucks.truckNum))
      .leftJoin(plantTruckStatuses, eq(plantTruckStatuses.truckId, trucks.id))
      .where(
        and(
          sql`UPPER(TRIM(${trucks.group})) = 'GASTECH VEHICLES'`,
          inArray(trucks.status, ['available', 'standby', 'maintenance'])
        )
      ),

    conn
      .select({
        truckNum: trucks.truckNum,
        slugNum: trucks.slugNum,
        customerName: customers.name,
        outboundTripStatus: outboundTrips.status,
        inboundTripStatus: inboundTrips.status,
        note: trucks.note,
      })
      .from(movements)
      .innerJoin(trucks, eq(movements.truckId, trucks.id))
      .leftJoin(customers, eq(movements.customerId, customers.id))
      .leftJoin(
        outboundTrips,
        and(eq(outboundTrips.movementId, movements.id), eq(outboundTrips.direction, 'outbound'))
      )
      .leftJoin(
        inboundTrips,
        and(eq(inboundTrips.movementId, movements.id), eq(inboundTrips.direction, 'inbound'))
      )
      .where(
        and(
          eq(movements.status, 'in_progress'),
          sql`UPPER(TRIM(${trucks.group})) = 'GASTECH VEHICLES'`
        )
      ),
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
    const withNote = (label: string) => (s.note?.trim() ? `${label}(${s.note.trim()})` : label);
    const withMaintenanceNote = (label: string) =>
      s.maintenanceNote?.trim() ? `${label}(${s.maintenanceNote.trim()})` : label;
    const fillState = s.fillState ?? 'empty';
    const bay = s.bay ?? 'parking_bay';
    const customerLabel =
      s.owner === 'customer'
        ? `${plantDisplayNumber(s.slugNum, s.skidNum, 4)}${s.customerName ? `(${s.customerName})` : ''}`
        : plantDisplayNumber(s.slugNum, s.skidNum, 4);
    const label = customerLabel;

    if (s.isOnMaintenance) {
      snapshot.maintenance.skids.push(withMaintenanceNote(label));
      continue;
    }

    if (fillState === 'on_hold') {
      snapshot.skidsOnHold.push(withNote(label));
    } else if (bay === 'washing_bay') {
      snapshot.skidsForWashing.push({
        skidNum: withNote(label),
        fillState,
      });
    } else if (s.isNew && fillState === 'loaded') {
      snapshot.newLoadedSkids.push(withNote(label));
    } else if (fillState === 'loading') {
      if (s.owner === 'customer') snapshot.skidsLoading.customer.push(withNote(label));
      else
        snapshot.skidsLoading.gastech.push(withNote(plantDisplayNumber(s.slugNum, s.skidNum, 4)));
    } else if (fillState === 'loaded') {
      if (s.owner === 'customer') snapshot.skidsLoaded.customer.push(withNote(label));
      else snapshot.skidsLoaded.gastech.push(withNote(plantDisplayNumber(s.slugNum, s.skidNum, 4)));
    } else if (fillState === 'empty') {
      if (s.owner === 'customer') snapshot.skidsEmpty.customer.push(withNote(label));
      else snapshot.skidsEmpty.gastech.push(withNote(plantDisplayNumber(s.slugNum, s.skidNum, 4)));
    }
  }

  // Categorize Trucks
  for (const t of allTrucks) {
    const displayNumber = plantDisplayNumber(t.slugNum, t.truckNum, 2);
    const truckLabel = t.maintenanceNote?.trim()
      ? `${displayNumber}(${t.maintenanceNote.trim()})`
      : t.note?.trim()
        ? `${displayNumber}(${t.note.trim()})`
        : displayNumber;
    if (t.isOnMaintenance) {
      snapshot.maintenance.trucks.push(truckLabel);
    } else if (
      t.isStandby &&
      t.currentLoc.trim().toUpperCase() === 'GASTECH PLANT' &&
      t.assignedDriver === null
    ) {
      snapshot.standbyTrucks.push(truckLabel);
    } else if (t.status === 'available' && t.currentLoc.trim() === 'GASTECH PLANT') {
      snapshot.trucksOnGround.push(truckLabel);
    }
  }

  // An inbound trip remains the active leg after arrival until the movement is completed.
  for (const m of activeMovements) {
    const displayNumber = plantDisplayNumber(m.slugNum, m.truckNum, 2);
    const truckLabel = m.note?.trim() ? `${displayNumber}(${m.note.trim()})` : displayNumber;
    if (m.inboundTripStatus !== null) {
      snapshot.returningTrucks.push(truckLabel);
    } else if (m.outboundTripStatus !== null) {
      snapshot.trucksInTransit.push({
        truckNum: truckLabel,
        customer: m.customerName ?? 'Unknown',
      });
    }
  }

  return snapshot;
}

/**
 * Format live fleet state into copy-ready WhatsApp text.
 */
export function formatPlantReportMessage(
  officersOnDuty: string,
  metrics: PlantReportMetrics,
  snapshot: PlantFleetSnapshot
): string {
  const bay = metrics.landingGearBox?.loadingAndWashingBay;
  const workshop = metrics.landingGearBox?.workshop;
  const wooden = metrics.landingGearBox?.wooden;
  const baseTotal = bay !== undefined && workshop !== undefined ? bay + workshop : undefined;
  const grandTotal =
    baseTotal !== undefined && wooden !== undefined ? baseTotal + wooden : undefined;

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
    `*INLET PRESSURE*: ${metrics.inletPressureBar !== undefined ? `${metrics.inletPressureBar} bar` : ''}`,
    '',
    `\`SKIDS LOADING AT\` ${metrics.loadingPressureBar !== undefined ? `${metrics.loadingPressureBar} bar` : ''}`,
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
    `*[LANDING GEARBOX AT LOADING BAY & WASHING BAY]*: ${bay ?? ''}`,
    '',
    `*[LANDING GEARBOX AT WORKSHOP]*: ${workshop !== undefined ? `${workshop}pcs` : ''}`,
    '',
    `*[Total landing gearbox]*: ${baseTotal !== undefined ? baseTotal : ''}${wooden !== undefined ? ` + (${wooden}) wooden` : ''}${grandTotal !== undefined ? `. Grand total = ${grandTotal}` : ''}`,
    '',
    `*Total new chassis in plant*: ${metrics.newChassisInPlant ?? ''}`,
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
        .insert(plantSkidStatuses)
        .values({
          skidId: u.id,
          fillState: u.fillState ?? 'empty',
          bay: u.fillState === 'loading' ? 'loading_bay' : (u.bay ?? 'parking_bay'),
          note: u.note?.trim() || null,
          isOnMaintenance: u.isOnMaintenance ?? false,
          maintenanceNote: u.maintenanceNote?.trim() || null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: plantSkidStatuses.skidId,
          set: {
            ...(u.fillState !== undefined && { fillState: u.fillState }),
            ...(u.fillState === 'loading'
              ? { bay: 'loading_bay' as const }
              : u.bay !== undefined
                ? { bay: u.bay }
                : {}),
            ...(u.note !== undefined && { note: u.note?.trim() || null }),
            ...(u.isOnMaintenance !== undefined && { isOnMaintenance: u.isOnMaintenance }),
            ...(u.maintenanceNote !== undefined && {
              maintenanceNote: u.maintenanceNote?.trim() || null,
            }),
            updatedAt: new Date(),
          },
        })
    )
  );
}

export async function submitPlantStatus(input: {
  officersOnDuty: string;
  metrics: PlantReportMetrics;
  skidUpdates?: SkidYardUpdate[];
  notes?: string | null;
}) {
  const { snapshot, report } = await db.transaction(async (tx) => {
    if (input.skidUpdates && input.skidUpdates.length > 0) {
      await batchUpdateSkidYardStates(input.skidUpdates, tx);
    }

    const snapshot = await getLivePlantFleetSnapshot(tx);
    const [report] = await tx
      .insert(plantReports)
      .values({
        officersOnDuty: input.officersOnDuty,
        metrics: input.metrics,
        fleetSnapshot: snapshot,
        notes: input.notes ?? null,
      })
      .returning({ id: plantReports.id, createdAt: plantReports.createdAt });

    return { snapshot, report };
  });

  const formattedMessage = formatPlantReportMessage(input.officersOnDuty, input.metrics, snapshot);

  return { snapshot, formattedMessage, report };
}
