import { and, count, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/backend/db';
import { geofenceZones } from '@/backend/db/schema/geofence-zone';
import { messages, processedMessages } from '@/backend/db/schema/messages';
import { apiDbError, apiSuccess } from '@/backend/lib/api-response';
import { findMatchingGeofence } from '@/backend/lib/geofence';
import { getLivePlantFleetSnapshot } from '@/backend/services/plant/report';
import {
  listDispatchNotifications,
  listMessages,
} from '@/backend/services/messages/dispatch-review-repository';
import { listActiveMovements } from '@/backend/services/movements/repository';
import { trucks } from '@/backend/db/schema/trucks';

type AlertRoute = 'tracker' | 'movements' | 'updates' | 'plant-report' | 'dispatch';
type AlertSeverity = 'critical' | 'warning' | 'info';

function hasValidCoordinates(lat: number, lon: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    (lat !== 0 || lon !== 0)
  );
}

export async function GET() {
  try {
    const [
      pendingDispatches,
      overdueNotifications,
      activeMovements,
      plantSnapshot,
      customerUpdateAlerts,
      trackedTrucks,
      zones,
    ] = await Promise.all([
      listMessages({ page: 1, limit: 1, type: 'dispatch', reviewStatus: 'pending' }),
      listDispatchNotifications(true),
      listActiveMovements(),
      getLivePlantFleetSnapshot(),
      db
        .select({ value: count() })
        .from(messages)
        .leftJoin(processedMessages, eq(processedMessages.messageId, messages.id))
        .where(
          and(
            eq(messages.type, 'update'),
            or(
              eq(messages.isProcessed, false),
              isNull(processedMessages.status),
              inArray(processedMessages.status, ['needs_review', 'failed'])
            )
          )
        ),
      db
        .select({ id: trucks.id, truckNum: trucks.truckNum, lat: trucks.lat, lon: trucks.lon })
        .from(trucks)
        .where(sql`UPPER(TRIM(${trucks.group})) = 'GASTECH VEHICLES'`),
      db.select().from(geofenceZones),
    ]);

    const routeCounts: Record<AlertRoute, number> = {
      tracker: 0,
      movements: 0,
      updates: 0,
      'plant-report': 0,
      dispatch: 0,
    };
    const alerts: {
      id: string;
      route: AlertRoute;
      href: string;
      title: string;
      description: string;
      count: number;
      severity: AlertSeverity;
    }[] = [];

    function addAlert(
      id: string,
      route: AlertRoute,
      title: string,
      description: string,
      alertCount: number,
      severity: AlertSeverity,
      href: string
    ) {
      if (alertCount < 1) return;
      routeCounts[route] += alertCount;
      alerts.push({ id, route, href, title, description, count: alertCount, severity });
    }

    addAlert(
      'dispatch-review',
      'dispatch',
      'Dispatch requests need review',
      'Check incoming dispatch details before they change fleet movements.',
      pendingDispatches.total,
      'warning',
      pendingDispatches.rows[0]
        ? `/dispatch?messageId=${encodeURIComponent(pendingDispatches.rows[0].id)}#dispatch-review`
        : '/dispatch#dispatch-review'
    );
    addAlert(
      'dispatch-notifications',
      'dispatch',
      'Dispatch notifications are overdue',
      'Confirm the customer notice was sent or review the copy-ready message.',
      overdueNotifications.length,
      'critical',
      overdueNotifications[0]
        ? `/dispatch?notificationId=${encodeURIComponent(overdueNotifications[0].notificationId)}#dispatch-notifications`
        : '/dispatch#dispatch-notifications'
    );

    const movementsReadyToComplete = activeMovements.filter(
      (movement) => movement.currentDirection === 'inbound' && movement.truckAtPlant
    );
    addAlert(
      'movement-completion',
      'movements',
      'Movements are ready to complete',
      'Confirm returned trucks and close their active movements.',
      movementsReadyToComplete.length,
      'warning',
      movementsReadyToComplete[0]
        ? `/movements?view=active&movementId=${encodeURIComponent(movementsReadyToComplete[0].id)}#movement-completion`
        : '/movements?view=active#movement-completion'
    );

    addAlert(
      'customer-updates-review',
      'updates',
      'Customer updates need review',
      'Some incoming updates are unprocessed or need attention.',
      Number(customerUpdateAlerts[0]?.value ?? 0),
      'warning',
      '/updates?view=customer&customerFilter=needs_review#customer-updates-review'
    );

    addAlert(
      'plant-truck-maintenance',
      'plant-report',
      'Trucks are on maintenance',
      'Review maintenance status and notes for trucks in the plant report.',
      plantSnapshot.maintenance.trucks.length,
      'warning',
      plantSnapshot.maintenance.trucks[0]
        ? `/plant-report?section=trucks&truck=${encodeURIComponent(plantSnapshot.maintenance.trucks[0].split('(')[0])}#plant-maintenance-trucks`
        : '/plant-report?section=trucks#plant-maintenance-trucks'
    );
    addAlert(
      'plant-skid-maintenance',
      'plant-report',
      'Skids are on maintenance',
      'Review maintenance status and notes for skids in the plant report.',
      plantSnapshot.maintenance.skids.length,
      'warning',
      plantSnapshot.maintenance.skids[0]
        ? `/plant-report?section=skids&skid=${encodeURIComponent(plantSnapshot.maintenance.skids[0].split('(')[0])}#plant-maintenance-skids`
        : '/plant-report?section=skids#plant-maintenance-skids'
    );

    const namedZones = zones.filter(
      (zone): zone is typeof zone & { geofenceName: string } => zone.geofenceName !== null
    );
    let trucksOutsideGeofences = 0;
    let trucksWithoutGps = 0;
    let firstTruckNeedingAttention: (typeof trackedTrucks)[number] | null = null;
    for (const truck of trackedTrucks) {
      if (!hasValidCoordinates(truck.lat, truck.lon)) {
        trucksWithoutGps += 1;
        firstTruckNeedingAttention ??= truck;
      } else if (namedZones.length && !findMatchingGeofence(namedZones, truck.lat, truck.lon)) {
        trucksOutsideGeofences += 1;
        firstTruckNeedingAttention ??= truck;
      }
    }
    addAlert(
      'tracker-location',
      'tracker',
      'Truck locations need attention',
      `${trucksOutsideGeofences} outside known geofences · ${trucksWithoutGps} without usable GPS.`,
      trucksOutsideGeofences + trucksWithoutGps,
      'critical',
      firstTruckNeedingAttention
        ? `/tracker?view=trucks&truckId=${encodeURIComponent(firstTruckNeedingAttention.id)}#tracker-location`
        : '/tracker?view=trucks#tracker-location'
    );

    return apiSuccess({
      alerts,
      routeCounts,
      total: alerts.reduce((sum, alert) => sum + alert.count, 0),
    });
  } catch (error) {
    return apiDbError(error);
  }
}
