import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  isNull,
  lt,
  sql,
} from 'drizzle-orm';
import { db } from '@fleet/database';
import {
  customerSkidLoadings,
  customers,
  movements,
  plantStatus,
  skids,
  trips,
  type PlantStatus as PlantStatusRecord,
} from '@fleet/database/schema';
import { getLivePlantFleetSnapshot } from './snapshot';

export async function getCurrentPlantStatus(): Promise<PlantStatusRecord | null> {
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
        customersServed: countDistinct(customerSkidLoadings.customerId),
      })
      .from(customerSkidLoadings)
      .where(
        and(
          gte(customerSkidLoadings.dispatchedAt, dayStart),
          lt(customerSkidLoadings.dispatchedAt, dayEnd),
        ),
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
          lt(trips.arrivedAt, dayEnd),
        ),
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

export async function getPlantStatusDashboard(date?: string) {
  const [
    fleetSnapshot,
    plantSkids,
    currentCustomerLoadings,
    currentStatus,
    dailyDispatchSummary,
  ] = await Promise.all([
    getLivePlantFleetSnapshot(),

    db
      .select({
        id: skids.id,
        skidNum: skids.skidNum,
        state: skids.state,
        isForWashing: skids.isForWashing,
        isNew: skids.isNew,
        customerName: customers.name,
      })
      .from(skids)
      .leftJoin(customers, eq(skids.customerId, customers.id))
      .where(
        and(
          eq(skids.status, 'available'),
          isNull(skids.customerId),
          sql`TRIM(${skids.currentLoc}) = 'GASTECH PLANT'`,
        ),
      ),

    db
      .select({
        id: customerSkidLoadings.id,
        customerId: customerSkidLoadings.customerId,
        customerName: customers.name,
        skidNum: customerSkidLoadings.skidNum,
        state: customerSkidLoadings.state,
        arrivedAt: customerSkidLoadings.arrivedAt,
        loadedAt: customerSkidLoadings.loadedAt,
      })
      .from(customerSkidLoadings)
      .innerJoin(customers, eq(customerSkidLoadings.customerId, customers.id))
      .where(isNull(customerSkidLoadings.dispatchedAt))
      .orderBy(desc(customerSkidLoadings.arrivedAt)),

    getCurrentPlantStatus(),
    getDailyDispatchSummary(date),
  ]);

  return {
    fleetSnapshot,
    plantSkids,
    customerSkidLoadings: currentCustomerLoadings,
    plantStatus: currentStatus,
    dailyDispatchSummary,
    previousMetrics: currentStatus?.metrics ?? null,
    previousOfficers: currentStatus?.officersOnDuty ?? '',
  };
}
