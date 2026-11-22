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
        .select({ lat: trucks.lat, lon: trucks.lon })
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
      '/dispatch'
    );
    addAlert(
      'dispatch-notifications',
      'dispatch',
      'Dispatch notifications are overdue',
      'Confirm the customer notice was sent or review the copy-ready message.',
      overdueNotifications.length,
      'critical',
      '/dispatch'
    );

    const movementsReadyToComplete = activeMovements.filter(
      (movement) => movement.currentDirection === 'inbound' && movement.truckAtPlant
    ).length;
    addAlert(
      'movement-completion',
      'movements',
      'Movements are ready to complete',
      'Confirm returned trucks and close their active movements.',
      movementsReadyToComplete,
      'warning',
      '/movements'
    );

    addAlert(
      'customer-updates-review',
      'updates',
      'Customer updates need review',
      'Some incoming updates are unprocessed or need attention.',
      Number(customerUpdateAlerts[0]?.value ?? 0),
      'warning',
      '/updates'
    );

    const maintenanceCount =
      plantSnapshot.maintenance.trucks.length + plantSnapshot.maintenance.skids.length;
    addAlert(
      'plant-maintenance',
      'plant-report',
      'Assets are on maintenance',
      'Review maintenance status and notes in the plant report.',
      maintenanceCount,
      'warning',
      '/plant-report'
    );

    const namedZones = zones.filter(
      (zone): zone is typeof zone & { geofenceName: string } => zone.geofenceName !== null
    );
    let trucksOutsideGeofences = 0;
    let trucksWithoutGps = 0;
    for (const truck of trackedTrucks) {
      if (!hasValidCoordinates(truck.lat, truck.lon)) {
        trucksWithoutGps += 1;
      } else if (namedZones.length && !findMatchingGeofence(namedZones, truck.lat, truck.lon)) {
        trucksOutsideGeofences += 1;
      }
    }
    addAlert(
      'tracker-location',
      'tracker',
      'Truck locations need attention',
      `${trucksOutsideGeofences} outside known geofences · ${trucksWithoutGps} without usable GPS.`,
      trucksOutsideGeofences + trucksWithoutGps,
      'critical',
      '/tracker'
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
