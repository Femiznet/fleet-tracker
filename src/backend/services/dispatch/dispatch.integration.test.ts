import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import dotenv from 'dotenv';
import { and, count, eq, like } from 'drizzle-orm';
import type { DbTransaction } from '../../db';

dotenv.config({ path: '.env.local' });

const databaseTest = process.env.DATABASE_URL ? test : test.skip;

databaseTest('dispatch and pickup lifecycle operations enforce movement rules', async () => {
  const [{ db }, schema, dispatch] = await Promise.all([
    import('../../db'),
    import('../../db/schema'),
    import('./index'),
  ]);
  const { customers, movements, skids, trips, trucks } = schema;
  const {
    cancelMovement,
    completeMovement,
    createDirectDispatch,
    createPickup,
    markMovementNotified,
  } = dispatch;
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
  const rollback = new Error('Roll back movement integration fixtures');

  await assert.rejects(
    db.transaction(async (tx) => {
      const [customer] = await tx
        .insert(customers)
        .values({
          name: `Movement integration ${suffix}`,
          geofenceName: `MOVE-${suffix}`,
        })
        .returning();

      async function addTruck(
        name: string,
        currentLoc: string,
        group = 'GASTECH VEHICLES',
        status: 'available' | 'standby' = 'available'
      ) {
        const [truck] = await tx
          .insert(trucks)
          .values({
            truckNum: `T-${suffix}-${name}`,
            group,
            lat: 1,
            lon: 1,
            currentLoc,
            speed: 0,
            status,
          })
          .returning();
        return truck;
      }

      async function addSkid(
        name: string,
        currentLoc: string,
        status: 'available' | 'at_customer' = 'available'
      ) {
        const [skid] = await tx
          .insert(skids)
          .values({
            skidNum: `S-${suffix}-${name}`,
            currentLoc,
            status,
          })
          .returning();
        return skid;
      }

      async function expectFailure(operation: (nested: DbTransaction) => Promise<unknown>) {
        await assert.rejects(tx.transaction(operation));
      }

      const plantTruck = await addTruck('PLANT', 'GASTECH PLANT');
      const plantSkid = await addSkid('PLANT', 'GASTECH PLANT');
      const direct = await createDirectDispatch(
        {
          truckId: plantTruck.id,
          customerId: customer.id,
          skidIdOut: plantSkid.id,
        },
        tx
      );

      const [directMovement] = await tx
        .select()
        .from(movements)
        .where(eq(movements.id, direct.movementId));
      assert.equal(
        direct.notificationDueAt.getTime() - directMovement.createdAt.getTime(),
        10 * 60 * 1000
      );
      assert.match(direct.notificationText, new RegExp(customer.name));
      assert.match(direct.notificationText, new RegExp(plantTruck.truckNum));
      assert.match(direct.notificationText, new RegExp(`${plantSkid.skidNum}`));
      assert.match(direct.notificationText, /UTC/);

      const [outboundTrip] = await tx
        .select()
        .from(trips)
        .where(eq(trips.movementId, direct.movementId));
      assert.equal(outboundTrip.direction, 'outbound');
      assert.equal(outboundTrip.status, 'in_transit');
      assert.equal(await markMovementNotified(direct.movementId, tx), true);
      assert.equal(await markMovementNotified(direct.movementId, tx), false);
      const [notifiedMovement] = await tx
        .select({ notifiedAt: movements.notifiedAt })
        .from(movements)
        .where(eq(movements.id, direct.movementId));
      assert.ok(notifiedMovement.notifiedAt instanceof Date);

      const duplicateSkid = await addSkid('DUPLICATE', 'GASTECH PLANT');
      await tx.update(trucks).set({ status: 'available' }).where(eq(trucks.id, plantTruck.id));
      await expectFailure((nested) =>
        createDirectDispatch(
          {
            truckId: plantTruck.id,
            customerId: customer.id,
            skidIdOut: duplicateSkid.id,
          },
          nested
        )
      );

      await tx.update(trucks).set({ status: 'in_transit' }).where(eq(trucks.id, plantTruck.id));
      await expectFailure((nested) =>
        completeMovement({ movementId: direct.movementId, skidIdIn: plantSkid.id }, nested)
      );
      await cancelMovement({ movementId: direct.movementId, note: 'integration cancellation' }, tx);
      const [cancelledMovement] = await tx
        .select({ status: movements.status })
        .from(movements)
        .where(eq(movements.id, direct.movementId));
      const [cancelledTrip] = await tx
        .select({ status: trips.status })
        .from(trips)
        .where(eq(trips.movementId, direct.movementId));
      const [cancelledTruck] = await tx
        .select({ status: trucks.status })
        .from(trucks)
        .where(eq(trucks.id, plantTruck.id));
      const [cancelledSkid] = await tx
        .select({ status: skids.status, currentLoc: skids.currentLoc })
        .from(skids)
        .where(eq(skids.id, plantSkid.id));
      assert.equal(cancelledMovement.status, 'cancelled');
      assert.equal(cancelledTrip.status, 'cancelled');
      assert.equal(cancelledTruck.status, 'available');
      assert.equal(cancelledSkid.status, 'available');
      assert.equal(cancelledSkid.currentLoc, 'GASTECH PLANT');

      const overrideTruck = await addTruck('OVERRIDE', 'REMOTE YARD');
      const overrideSkid = await addSkid('OVERRIDE', 'REMOTE YARD');
      await expectFailure((nested) =>
        createDirectDispatch(
          {
            truckId: overrideTruck.id,
            customerId: customer.id,
            skidIdOut: overrideSkid.id,
          },
          nested
        )
      );
      const overridden = await createDirectDispatch(
        {
          truckId: overrideTruck.id,
          customerId: customer.id,
          skidIdOut: overrideSkid.id,
          forceOverride: true,
        },
        tx
      );
      const [overriddenMovement] = await tx
        .select()
        .from(movements)
        .where(eq(movements.id, overridden.movementId));
      assert.match(overriddenMovement.note ?? '', /Manual Sensor Override/);

      await tx
        .update(trucks)
        .set({ currentLoc: 'GASTECH PLANT' })
        .where(eq(trucks.id, overrideTruck.id));
      await tx
        .update(trips)
        .set({ status: 'arrived', arrived: true })
        .where(and(eq(trips.movementId, overridden.movementId), eq(trips.direction, 'outbound')));
      await tx.insert(trips).values({
        movementId: overridden.movementId,
        direction: 'inbound',
        origin: customer.geofenceName ?? 'CUSTOMER SITE',
        destination: 'GASTECH PLANT',
      });
      await completeMovement({ movementId: overridden.movementId, skidIdIn: overrideSkid.id }, tx);

      const [completedMovement] = await tx
        .select()
        .from(movements)
        .where(eq(movements.id, overridden.movementId));
      const [completedTruck] = await tx
        .select()
        .from(trucks)
        .where(eq(trucks.id, overrideTruck.id));
      const [completedSkid] = await tx.select().from(skids).where(eq(skids.id, overrideSkid.id));
      assert.equal(completedMovement.status, 'completed');
      assert.equal(completedTruck.status, 'available');
      assert.equal(completedSkid.status, 'available');
      assert.equal(completedSkid.currentLoc, 'GASTECH PLANT');

      const pickupTruck = await addTruck('PICKUP', customer.geofenceName ?? '');
      const pickupSkid = await addSkid('PICKUP', customer.geofenceName ?? '', 'at_customer');
      const pickupId = await createPickup(
        {
          truckId: pickupTruck.id,
          customerId: customer.id,
          skidIdIn: pickupSkid.id,
        },
        tx
      );
      const [pickupTrip] = await tx.select().from(trips).where(eq(trips.movementId, pickupId));
      assert.equal(pickupTrip.direction, 'inbound');
      assert.equal(pickupTrip.status, 'in_transit');
      await tx
        .update(trucks)
        .set({ currentLoc: 'GASTECH PLANT' })
        .where(eq(trucks.id, pickupTruck.id));
      await completeMovement({ movementId: pickupId, skidIdIn: pickupSkid.id }, tx);
      const [completedPickup] = await tx
        .select({ status: movements.status })
        .from(movements)
        .where(eq(movements.id, pickupId));
      const [completedPickupTruck] = await tx
        .select({ status: trucks.status })
        .from(trucks)
        .where(eq(trucks.id, pickupTruck.id));
      const [completedPickupSkid] = await tx
        .select({ status: skids.status, currentLoc: skids.currentLoc })
        .from(skids)
        .where(eq(skids.id, pickupSkid.id));
      assert.equal(completedPickup.status, 'completed');
      assert.equal(completedPickupTruck.status, 'available');
      assert.equal(completedPickupSkid.status, 'available');
      assert.equal(completedPickupSkid.currentLoc, 'GASTECH PLANT');

      const overridePickupTruck = await addTruck('PICKUP-OVERRIDE', 'REMOTE YARD');
      const overridePickupSkid = await addSkid(
        'PICKUP-OVERRIDE',
        customer.geofenceName ?? '',
        'at_customer'
      );
      await expectFailure((nested) =>
        createPickup(
          {
            truckId: overridePickupTruck.id,
            customerId: customer.id,
            skidIdIn: overridePickupSkid.id,
          },
          nested
        )
      );
      const overridePickupId = await createPickup(
        {
          truckId: overridePickupTruck.id,
          customerId: customer.id,
          skidIdIn: overridePickupSkid.id,
          forceOverride: true,
        },
        tx
      );
      await cancelMovement({ movementId: overridePickupId }, tx);
      const [cancelledPickup] = await tx
        .select({ status: movements.status })
        .from(movements)
        .where(eq(movements.id, overridePickupId));
      const [cancelledPickupSkid] = await tx
        .select({ status: skids.status, currentLoc: skids.currentLoc })
        .from(skids)
        .where(eq(skids.id, overridePickupSkid.id));
      assert.equal(cancelledPickup.status, 'cancelled');
      assert.equal(cancelledPickupSkid.status, 'at_customer');
      assert.equal(cancelledPickupSkid.currentLoc, 'REMOTE YARD');

      const invalidGroupTruck = await addTruck(
        'INVALID-GROUP',
        'GASTECH PLANT',
        'CUSTOMER VEHICLES'
      );
      const invalidGroupSkid = await addSkid('INVALID-GROUP', 'GASTECH PLANT');
      await expectFailure((nested) =>
        createDirectDispatch(
          {
            truckId: invalidGroupTruck.id,
            customerId: customer.id,
            skidIdOut: invalidGroupSkid.id,
          },
          nested
        )
      );

      const invalidSkidTruck = await addTruck('INVALID-SKID', 'GASTECH PLANT');
      const invalidSkid = await addSkid('INVALID-SKID', customer.geofenceName ?? '', 'at_customer');
      await expectFailure((nested) =>
        createDirectDispatch(
          {
            truckId: invalidSkidTruck.id,
            customerId: customer.id,
            skidIdOut: invalidSkid.id,
          },
          nested
        )
      );

      const unavailableTruck = await addTruck(
        'UNAVAILABLE',
        'GASTECH PLANT',
        'GASTECH VEHICLES',
        'standby'
      );
      const unavailableSkid = await addSkid('UNAVAILABLE', 'GASTECH PLANT');
      await expectFailure((nested) =>
        createDirectDispatch(
          {
            truckId: unavailableTruck.id,
            customerId: customer.id,
            skidIdOut: unavailableSkid.id,
          },
          nested
        )
      );

      const invalidCustomerTruck = await addTruck('INVALID-CUSTOMER', 'GASTECH PLANT');
      const invalidCustomerSkid = await addSkid('INVALID-CUSTOMER', 'GASTECH PLANT');
      await expectFailure((nested) =>
        createDirectDispatch(
          {
            truckId: invalidCustomerTruck.id,
            customerId: randomUUID(),
            skidIdOut: invalidCustomerSkid.id,
          },
          nested
        )
      );

      throw rollback;
    }),
    (error) => error === rollback
  );

  const [remainingTestTrucks] = await db
    .select({ value: count() })
    .from(trucks)
    .where(like(trucks.truckNum, `T-${suffix}-%`));
  assert.equal(Number(remainingTestTrucks.value), 0);
});
