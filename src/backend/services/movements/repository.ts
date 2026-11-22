import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/backend/db';
import { customers, drivers, movements, skids, trips, trucks } from '@/backend/db/schema';

export async function listMovements(page: number, limit: number) {
  const offset = (page - 1) * limit;
  const [rows, totalRows] = await Promise.all([
    db.select().from(movements).orderBy(desc(movements.id)).limit(limit).offset(offset),
    db.select({ value: count() }).from(movements),
  ]);

  return { rows, total: Number(totalRows[0]?.value ?? 0) };
}

export async function getMovementById(id: string) {
  const [movement] = await db.select().from(movements).where(eq(movements.id, id));
  return movement ?? null;
}

export async function listActiveMovements() {
  const outboundTrips = alias(trips, 'active_outbound_trips');
  const inboundTrips = alias(trips, 'active_inbound_trips');
  const returnSkids = alias(skids, 'movement_return_skids');
  const rows = await db
    .select({
      id: movements.id,
      type: movements.type,
      status: movements.status,
      startedAt: movements.createdAt,
      note: movements.note,
      truckId: trucks.id,
      truckNum: trucks.truckNum,
      truckStatus: trucks.status,
      truckCurrentLoc: trucks.currentLoc,
      truckSpeed: trucks.speed,
      customerId: customers.id,
      customerName: customers.name,
      customerGeofence: customers.geofenceName,
      skidIdOut: skids.id,
      skidNumOut: skids.skidNum,
      skidIdIn: returnSkids.id,
      skidNumIn: returnSkids.skidNum,
      outboundTripStatus: outboundTrips.status,
      inboundTripStatus: inboundTrips.status,
    })
    .from(movements)
    .innerJoin(trucks, eq(movements.truckId, trucks.id))
    .leftJoin(customers, eq(movements.customerId, customers.id))
    .leftJoin(skids, eq(movements.skidIdOut, skids.id))
    .leftJoin(returnSkids, eq(movements.skidIdIn, returnSkids.id))
    .leftJoin(
      outboundTrips,
      and(eq(outboundTrips.movementId, movements.id), eq(outboundTrips.direction, 'outbound'))
    )
    .leftJoin(
      inboundTrips,
      and(eq(inboundTrips.movementId, movements.id), eq(inboundTrips.direction, 'inbound'))
    )
    .where(and(eq(movements.status, 'in_progress'), inArray(movements.type, ['dispatch', 'pickup'])))
    .orderBy(desc(movements.createdAt))
    .limit(100);

  return rows.map((row) => ({
    ...row,
    currentDirection:
      row.inboundTripStatus !== null
        ? ('inbound' as const)
        : row.outboundTripStatus !== null
          ? ('outbound' as const)
          : row.type === 'pickup'
            ? ('inbound' as const)
            : ('outbound' as const),
    currentTripStatus: row.inboundTripStatus ?? row.outboundTripStatus,
    truckAtPlant: row.truckCurrentLoc.trim().toUpperCase() === 'GASTECH PLANT',
  }));
}

export async function getMovementOptions() {
  const [availableTrucks, relevantSkids, activeCustomers] = await Promise.all([
    db
      .select({
        id: trucks.id,
        truckNum: trucks.truckNum,
        currentLoc: trucks.currentLoc,
        status: trucks.status,
        driverName: drivers.name,
        driverContact: drivers.phone,
      })
      .from(trucks)
      .leftJoin(drivers, eq(drivers.currentTruck, trucks.truckNum))
      .where(
        and(
          eq(trucks.status, 'available'),
          sql`UPPER(TRIM(${trucks.group})) = 'GASTECH VEHICLES'`
        )
      )
      .orderBy(trucks.truckNum),
    db
      .select({
        id: skids.id,
        skidNum: skids.skidNum,
        customerId: skids.customerId,
        currentLoc: skids.currentLoc,
        status: skids.status,
        owner: skids.owner,
      })
      .from(skids)
      .where(inArray(skids.status, ['available', 'at_customer', 'in_transit']))
      .orderBy(skids.skidNum),
    db
      .select({
        id: customers.id,
        name: customers.name,
        geofenceName: customers.geofenceName,
      })
      .from(customers)
      .where(eq(customers.isActive, true))
      .orderBy(customers.name),
  ]);

  return { trucks: availableTrucks, skids: relevantSkids, customers: activeCustomers };
}
