'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Box,
  Clock3,
  Fuel,
  Gauge,
  PackageCheck,
  RefreshCw,
  Truck as TruckIcon,
} from 'lucide-react';
import { getPlantDashboard } from '@/frontend/actions/plant-reports';
import { listDashboardSkids } from '@/frontend/actions/skids';
import { listDashboardTrucks } from '@/frontend/actions/trucks';
import type { PlantDashboardData, PlantFleetSnapshot } from '@/frontend/types/plant-report';
import type { Skid } from '@/frontend/types/skid';
import type { Truck } from '@/frontend/types/truck';
import OperationsSidebar from './operations-sidebar';
import styles from './operations-dashboard.module.css';

const REFRESH_INTERVAL_MS = 30_000;

type TruckData = { trucks: Truck[]; total: number };
type SkidData = { skids: Skid[]; total: number };

function formatTime(value: Date | null) {
  if (!value) return 'Not checked yet';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    value
  );
}

function displayStatus(value: string) {
  return value.replaceAll('_', ' ');
}

function statusStyle(status: string) {
  if (status === 'available' || status === 'loaded' || status === 'idle') return styles.pillGreen;
  if (status === 'in_transit' || status === 'loading') return styles.pillBlue;
  if (status === 'maintenance' || status === 'on_hold' || status === 'washing')
    return styles.pillAmber;
  if (status === 'at_customer') return styles.pillBlue;
  return '';
}

function countSkids(groups: { customer: string[]; gastech: string[] }) {
  return groups.customer.length + groups.gastech.length;
}

function TruckLocations({
  trucks,
  total,
  loading,
  error,
}: {
  trucks: TruckData | null;
  total: number | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>Truck locations</h2>
          <p className={styles.panelSubtitle}>
            Stored HCL Tracker coordinates and last resolved location.
          </p>
        </div>
        <TruckIcon size={17} />
      </header>
      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}
      {loading && !trucks ? (
        <div className={styles.empty}>
          <RefreshCw size={17} className="animate-spin" /> Loading trucks…
        </div>
      ) : !trucks?.trucks.length ? (
        <div className={styles.empty}>
          <TruckIcon size={18} />
          <strong>No trucks registered</strong>
          <span>Truck locations will appear after trucks are added and synced.</span>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Truck</th>
                <th>Status</th>
                <th>Location</th>
                <th>Speed</th>
                <th>Coordinates</th>
              </tr>
            </thead>
            <tbody>
              {trucks.trucks.map((truck) => (
                <tr key={truck.id}>
                  <td>
                    <strong>{truck.truckNum}</strong>
                    {truck.slugNum ? <span className={styles.subtle}>{truck.slugNum}</span> : null}
                  </td>
                  <td>
                    <span className={`${styles.pill} ${statusStyle(truck.status)}`}>
                      {displayStatus(truck.status)}
                    </span>
                  </td>
                  <td>{truck.currentLoc === 'pending' ? 'Location pending' : truck.currentLoc}</td>
                  <td>{truck.speed.toLocaleString()} km/h</td>
                  <td>
                    {truck.lat.toFixed(4)}, {truck.lon.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.listFooter}>
            Showing {trucks.trucks.length} of {total ?? trucks.total} trucks
          </div>
        </div>
      )}
      <p className={styles.freshnessNote}>
        <Clock3 size={12} />
        The API does not store a location-sync timestamp, so coordinate freshness cannot yet be
        confirmed here.
      </p>
    </section>
  );
}

function SkidInventory({
  skids,
  total,
  loading,
  error,
}: {
  skids: SkidData | null;
  total: number | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>Skid inventory</h2>
          <p className={styles.panelSubtitle}>
            Current recorded location, fill state, and yard status.
          </p>
        </div>
        <Box size={17} />
      </header>
      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}
      {loading && !skids ? (
        <div className={styles.empty}>
          <RefreshCw size={17} className="animate-spin" /> Loading skids…
        </div>
      ) : !skids?.skids.length ? (
        <div className={styles.empty}>
          <Box size={18} />
          <strong>No skids registered</strong>
          <span>Skid inventory will appear when skids are added.</span>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Skid</th>
                <th>Location</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Maintenance</th>
              </tr>
            </thead>
            <tbody>
              {skids.skids.map((skid) => (
                <tr key={skid.id}>
                  <td>
                    <strong>{skid.skidNum}</strong>
                    {skid.isNew ? <span className={styles.subtle}>New skid</span> : null}
                  </td>
                  <td>{skid.currentLoc === 'pending' ? 'Location pending' : skid.currentLoc}</td>
                  <td>
                    <span className={`${styles.pill} ${statusStyle(skid.status)}`}>
                      {displayStatus(skid.status)}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.pill} ${statusStyle(skid.owner)}`}>
                      {displayStatus(skid.owner)}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`${styles.pill} ${skid.isOnMaintenance ? statusStyle('maintenance') : ''}`}
                    >
                      {skid.isOnMaintenance ? 'Maintenance' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.listFooter}>
            Showing {skids.skids.length} of {total ?? skids.total} skids
          </div>
        </div>
      )}
    </section>
  );
}

function LivePlantSnapshot({
  snapshot,
  loading,
  error,
}: {
  snapshot: PlantFleetSnapshot | null;
  loading: boolean;
  error: string | null;
}) {
  if (error)
    return (
      <div className={styles.error} role="alert">
        {error}
      </div>
    );
  if (!snapshot) {
    return (
      <div className={styles.empty}>
        {loading ? 'Loading live plant status…' : 'Plant status is unavailable.'}
      </div>
    );
  }

  const truckStatuses = [
    { label: 'On ground', count: snapshot.trucksOnGround.length },
    { label: 'In transit', count: snapshot.trucksInTransit.length },
    { label: 'Returning', count: snapshot.returningTrucks.length },
    { label: 'Standby', count: snapshot.standbyTrucks.length },
    { label: 'Truck maintenance', count: snapshot.maintenance.trucks.length },
  ];
  const skidStatuses = [
    { label: 'Loading', count: countSkids(snapshot.skidsLoading) },
    { label: 'Loaded', count: countSkids(snapshot.skidsLoaded) },
    { label: 'Empty', count: countSkids(snapshot.skidsEmpty) },
    { label: 'On hold', count: snapshot.skidsOnHold.length },
    { label: 'For washing', count: snapshot.skidsForWashing.length },
    { label: 'Skid maintenance', count: snapshot.maintenance.skids.length },
  ];

  return (
    <div className={styles.panelBody}>
      <div className={styles.statusGrid}>
        {truckStatuses.map((status) => (
          <div className={styles.statusTile} key={status.label}>
            <span className={styles.statusLabel}>{status.label}</span>
            <strong className={styles.statusNumber}>{status.count}</strong>
          </div>
        ))}
      </div>
      <div className={styles.skidSummary}>
        {skidStatuses.map((status) => (
          <div className={styles.summaryItem} key={status.label}>
            <span className={styles.summaryLabel}>{status.label}</span>
            <strong className={styles.summaryCount}>{status.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlantReportSummary({
  data,
  loading,
  error,
}: {
  data: PlantDashboardData | null;
  loading: boolean;
  error: string | null;
}) {
  if (error)
    return (
      <div className={styles.error} role="alert">
        {error}
      </div>
    );
  if (!data) {
    return (
      <div className={styles.empty}>
        {loading ? 'Loading plant report…' : 'Plant report is unavailable.'}
      </div>
    );
  }

  return (
    <div className={styles.panelBody}>
      <div className={styles.reportDetails}>
        <div className={styles.reportMetric}>
          <label>Loading</label>
          <strong>{countSkids(data.fleetSnapshot.skidsLoading)}</strong>
        </div>
        <div className={styles.reportMetric}>
          <label>Loaded</label>
          <strong>{countSkids(data.fleetSnapshot.skidsLoaded)}</strong>
        </div>
        <div className={styles.reportMetric}>
          <label>Empty</label>
          <strong>{countSkids(data.fleetSnapshot.skidsEmpty)}</strong>
        </div>
        <div className={styles.reportMetric}>
          <label>On hold</label>
          <strong>{data.fleetSnapshot.skidsOnHold.length}</strong>
        </div>
      </div>
      <p className={styles.freshnessNote}>
        <Clock3 size={12} />
        {data.plantSkids.length} available skid{data.plantSkids.length === 1 ? '' : 's'} currently
        recorded at the plant.
      </p>
    </div>
  );
}

export default function OperationsDashboard() {
  const [truckData, setTruckData] = useState<TruckData | null>(null);
  const [skidData, setSkidData] = useState<SkidData | null>(null);
  const [plantData, setPlantData] = useState<PlantDashboardData | null>(null);
  const [truckError, setTruckError] = useState<string | null>(null);
  const [skidError, setSkidError] = useState<string | null>(null);
  const [plantError, setPlantError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const [trucksResult, skidsResult, plantResult] = await Promise.allSettled([
      listDashboardTrucks(),
      listDashboardSkids(),
      getPlantDashboard(),
    ]);

    if (trucksResult.status === 'fulfilled') {
      setTruckData(trucksResult.value);
      setTruckError(null);
    } else {
      setTruckError(
        trucksResult.reason instanceof Error
          ? trucksResult.reason.message
          : 'Unable to load trucks.'
      );
    }

    if (skidsResult.status === 'fulfilled') {
      setSkidData(skidsResult.value);
      setSkidError(null);
    } else {
      setSkidError(
        skidsResult.reason instanceof Error ? skidsResult.reason.message : 'Unable to load skids.'
      );
    }

    if (plantResult.status === 'fulfilled') {
      setPlantData(plantResult.value);
      setPlantError(null);
    } else {
      setPlantError(
        plantResult.reason instanceof Error
          ? plantResult.reason.message
          : 'Unable to load plant status.'
      );
    }

    setLastChecked(new Date());
    if (showLoading) setLoading(false);
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(true), 0);
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const snapshot = plantData?.fleetSnapshot ?? null;
  const loadingSkidCount = snapshot ? countSkids(snapshot.skidsLoading) : null;
  const inTransitCount = snapshot?.trucksInTransit.length ?? null;

  return (
    <div className={styles.shell}>
      <OperationsSidebar active="overview" />
      <main className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.breadcrumb}>
            <span>Operations</span>
            <span>/</span>
            <strong>Overview</strong>
          </div>
          <div className={styles.refreshInfo}>
            <span className={styles.liveDot} />
            {lastChecked
              ? `Dashboard checked ${formatTime(lastChecked)}`
              : 'Checking operational data…'}
          </div>
        </div>

        <header className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>Fleet operations</p>
            <h1 className={styles.title}>Operations overview</h1>
            <p className={styles.subtitle}>
              Plant condition, fleet positions, and skid availability in one view.
            </p>
          </div>
          <button
            className={styles.refreshButton}
            type="button"
            onClick={() => void refresh(true)}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} /> Refresh
          </button>
        </header>

        <section className={styles.stats} aria-label="Fleet overview">
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <TruckIcon size={17} />
            </div>
            <div>
              <p className={styles.statLabel}>Registered trucks</p>
              <p className={styles.statValue}>{truckData?.total ?? '—'}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconBlue}`}>
              <Gauge size={17} />
            </div>
            <div>
              <p className={styles.statLabel}>Trucks in transit</p>
              <p className={styles.statValue}>{inTransitCount ?? '—'}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconAmber}`}>
              <PackageCheck size={17} />
            </div>
            <div>
              <p className={styles.statLabel}>Skids loading</p>
              <p className={styles.statValue}>{loadingSkidCount ?? '—'}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <Fuel size={17} />
            </div>
            <div>
              <p className={styles.statLabel}>Skids at plant</p>
              <p className={styles.statValue}>{plantData?.plantSkids.length ?? '—'}</p>
            </div>
          </div>
        </section>

        <div className={styles.panelGrid}>
          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Live plant & fleet status</h2>
                <p className={styles.panelSubtitle}>
                  Current movement and yard categories from the backend snapshot.
                </p>
              </div>
              <Gauge size={17} />
            </header>
            <LivePlantSnapshot snapshot={snapshot} loading={loading} error={plantError} />
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Live plant status</h2>
                <p className={styles.panelSubtitle}>Current skid categories and bay states.</p>
              </div>
              <Fuel size={17} />
            </header>
            <PlantReportSummary data={plantData} loading={loading} error={plantError} />
          </section>
        </div>

        <div className={styles.panelGrid}>
          <TruckLocations
            trucks={truckData}
            total={truckData?.total ?? null}
            loading={loading}
            error={truckError}
          />
          <SkidInventory
            skids={skidData}
            total={skidData?.total ?? null}
            loading={loading}
            error={skidError}
          />
        </div>

        <div className={styles.panelHeader}>
          <p className={styles.panelSubtitle}>
            {lastChecked
              ? `Dashboard refreshes every 30 seconds · Last checked ${formatTime(lastChecked)}`
              : 'Dashboard refreshes every 30 seconds.'}
          </p>
          <Link className={styles.link} href="/dispatch">
            Open dispatch review
          </Link>
        </div>
      </main>
    </div>
  );
}
