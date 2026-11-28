import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { dbtx } from '@fleet/database';
import type { DbTransaction } from '@fleet/database';
import {
  customerSkidLoadings,
  customers,
  movements,
  skids,
  trips,
  trucks,
  type PlantFleetSnapshot,
} from '@fleet/database/schema';

export async function getLivePlantFleetSnapshot(
  tx?: DbTransaction,
): Promise<PlantFleetSnapshot> {
  const conn = dbtx(tx);

  const [allSkids, customerLoadings, allTrucks, activeMovements] =
    await Promise.all([
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
                sql`TRIM(${skids.currentLoc}) = 'GASTECH PLANT'`,
              ),
            ),
          ),
        ),

      conn
        .select({
          skidNum: customerSkidLoadings.skidNum,
          state: customerSkidLoadings.state,
          customerName: customers.name,
        })
        .from(customerSkidLoadings)
        .innerJoin(customers, eq(customerSkidLoadings.customerId, customers.id))
        .where(isNull(customerSkidLoadings.dispatchedAt)),

      conn
        .select({
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
        })
        .from(movements)
        .innerJoin(trucks, eq(movements.truckId, trucks.id))
        .leftJoin(customers, eq(movements.customerId, customers.id))
        .leftJoin(
          trips,
          and(
            eq(trips.movementId, movements.id),
            eq(trips.status, 'in_transit'),
          ),
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

  for (const loading of customerLoadings) {
    const label = `${loading.skidNum}(${loading.customerName})`;
    if (loading.state === 'on_hold') {
      snapshot.skidsOnHold.push(label);
    } else if (loading.state === 'loading') {
      snapshot.skidsLoading.customer.push(label);
    } else if (loading.state === 'loaded') {
      snapshot.skidsLoaded.customer.push(label);
    } else {
      snapshot.skidsEmpty.customer.push(label);
    }
  }

  for (const skid of allSkids) {
    const label = skid.skidNum;

    if (skid.status === 'maintenance') {
      snapshot.maintenance.skids.push(label);
      continue;
    }

    if (skid.state === 'on_hold') {
      snapshot.skidsOnHold.push(label);
    } else if (skid.isForWashing) {
      snapshot.skidsForWashing.push({
        skidNum: label,
        state: skid.state,
      });
    } else if (skid.isNew && skid.state === 'loaded') {
      snapshot.newLoadedSkids.push(label);
    } else if (skid.state === 'loading') {
      snapshot.skidsLoading.gastech.push(skid.skidNum);
    } else if (skid.state === 'loaded') {
      snapshot.skidsLoaded.gastech.push(skid.skidNum);
    } else if (skid.state === 'empty') {
      snapshot.skidsEmpty.gastech.push(skid.skidNum);
    }
  }

  for (const truck of allTrucks) {
    if (truck.status === 'maintenance') {
      snapshot.maintenance.trucks.push(truck.truckNum);
    } else if (truck.status === 'standby') {
      snapshot.standbyTrucks.push(truck.truckNum);
    } else if (
      truck.status === 'available' &&
      truck.currentLoc.trim() === 'GASTECH PLANT'
    ) {
      snapshot.trucksOnGround.push(truck.truckNum);
    }
  }

  for (const movement of activeMovements) {
    if (movement.tripDirection === 'inbound') {
      snapshot.returningTrucks.push({
        truckNum: movement.truckNum,
        customer: movement.customerName ?? 'Unknown',
      });
    } else if (movement.tripDirection === 'outbound') {
      snapshot.trucksInTransit.push({
        truckNum: movement.truckNum,
        customer: movement.customerName ?? 'Unknown',
      });
    }
  }

  return snapshot;
}
