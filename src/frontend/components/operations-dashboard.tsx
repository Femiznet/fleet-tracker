'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ClipboardList,
  MapPinned,
  MessageSquareText,
  RefreshCw,
  Truck as TruckIcon,
  Box,
} from 'lucide-react';
import {
  getOperationsOverview,
  type OperationsOverviewData,
} from '@/frontend/actions/operations-overview';
import OperationsSidebar from './operations-sidebar';
import styles from './operations-dashboard.module.css';

const REFRESH_INTERVAL_MS = 30_000;

function formatTime(value: Date | null) {
  if (!value) return 'Not checked yet';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    value
  );
}

function SummaryPanel({
  title,
  description,
  data,
  loading,
  icon,
  totalLabel,
  metrics,
}: {
  title: string;
  description: string;
  data: OperationsOverviewData['trucks'] | OperationsOverviewData['skids'] | null;
  loading: boolean;
  icon: ReactNode;
  totalLabel: string;
  metrics: { label: string; value: number | undefined }[];
}) {
  return (
    <section className={styles.summaryPanel}>
      <header className={styles.summaryHeader}>
        <span className={styles.summaryIcon}>{icon}</span>
        <div>
          <h2 className={styles.panelTitle}>{title}</h2>
          <p className={styles.panelSubtitle}>{description}</p>
        </div>
      </header>
      <div className={styles.summaryTotal}>
        <strong>{data ? data.total.toLocaleString() : loading ? '—' : 'Unavailable'}</strong>
        <span>{totalLabel}</span>
      </div>
      <div className={styles.summaryMetrics}>
        {metrics.map((metric) => (
          <div className={styles.summaryMetric} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value?.toLocaleString() ?? '—'}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function GeofenceBoard({
  overview,
  loading,
}: {
  overview: OperationsOverviewData | null;
  loading: boolean;
}) {
  return (
    <section className={styles.geofencePanel}>
      <header className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>Geofence activity</h2>
          <p className={styles.panelSubtitle}>
            Tracked Gastech trucks matched to known geofences using their latest stored coordinates.
          </p>
        </div>
        <MapPinned size={18} />
      </header>
      {loading && !overview ? (
        <div className={styles.empty}>Loading geofences…</div>
      ) : !overview ? (
        <div className={styles.empty}>Geofence data is unavailable.</div>
      ) : !overview.geofences.length ? (
        <div className={styles.empty}>
          <MapPinned size={19} />
          <strong>No geofences available</strong>
          <span>Known locations will appear here after geofences are created.</span>
        </div>
      ) : (
        <div className={styles.geofenceGrid}>
          {overview.geofences.map((geofence) => (
            <article className={styles.geofenceCard} key={geofence.name}>
              <span className={styles.geofenceName}>{geofence.name}</span>
              <strong className={styles.geofenceCount}>{geofence.trucks}</strong>
              <span className={styles.geofenceCaption}>
                {geofence.trucks === 1 ? 'truck here' : 'trucks here'}
              </span>
              {!geofence.configured ? (
                <span className={styles.geofenceUnconfigured}>Awaiting location data</span>
              ) : null}
            </article>
          ))}
        </div>
      )}
      {overview ? (
        <div className={styles.geofenceFooter}>
          <span>{overview.trucksOutsideGeofences} outside known geofences</span>
          <span>{overview.trucksWithoutGps} without usable GPS coordinates</span>
        </div>
      ) : null}
      <p className={styles.freshnessNote}>
        Location timestamps are not available, so counts may reflect an older GPS update.
      </p>
    </section>
  );
}

export default function OperationsDashboard() {
  const [overview, setOverview] = useState<OperationsOverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      setOverview(await getOperationsOverview());
      setError(null);
      setLastChecked(new Date());
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load the operations overview.'
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(true), 0);
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refresh]);

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
            <span className={`${styles.liveDot} ${error ? styles.liveDotError : ''}`} />
            {error
              ? 'Dashboard refresh failed'
              : lastChecked
                ? `Dashboard checked ${formatTime(lastChecked)}`
                : 'Checking operational data…'}
          </div>
        </div>

        <header className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>Fleet operations</p>
            <h1 className={styles.title}>Operations overview</h1>
            <p className={styles.subtitle}>
              A live snapshot of fleet, plant inventory, and customer locations.
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

        {error ? (
          <div className={styles.errorBanner} role="alert">
            {overview ? `Refresh failed: ${error}. Showing the last loaded data.` : error}
          </div>
        ) : null}

        <section className={styles.summaryGrid} aria-label="Fleet and skid summaries">
          <SummaryPanel
            title="Fleet"
            description="Current status across all registered trucks."
            data={overview?.trucks ?? null}
            loading={loading}
            icon={<TruckIcon size={18} />}
            totalLabel="registered trucks"
            metrics={[
              { label: 'At plant', value: overview?.trucks.atPlant },
              { label: 'In transit', value: overview?.trucks.inTransit },
              { label: 'Standby', value: overview?.trucks.standby },
              { label: 'Maintenance', value: overview?.trucks.maintenance },
            ]}
          />
          <SummaryPanel
            title="Skid inventory"
            description="Current status across all registered skids."
            data={overview?.skids ?? null}
            loading={loading}
            icon={<Box size={18} />}
            totalLabel="registered skids"
            metrics={[
              { label: 'At plant', value: overview?.skids.atPlant },
              { label: 'In transit', value: overview?.skids.inTransit },
              { label: 'At customer', value: overview?.skids.atCustomer },
              { label: 'Maintenance', value: overview?.skids.maintenance },
            ]}
          />
        </section>

        <GeofenceBoard overview={overview} loading={loading} />

        <section className={styles.quickActions}>
          <header className={styles.quickActionsHeader}>
            <div>
              <h2 className={styles.panelTitle}>Quick actions</h2>
              <p className={styles.panelSubtitle}>Jump straight to common operations.</p>
            </div>
          </header>
          <div className={styles.actionGrid}>
            <Link className={styles.actionCard} href="/dispatch">
              <span className={styles.actionIcon}>
                <ClipboardList size={17} />
              </span>
              <span className={styles.actionCopy}>
                <strong>Review dispatches</strong>
                <small>Check incoming dispatch requests</small>
              </span>
              <ArrowUpRight size={15} />
            </Link>
            <Link className={styles.actionCard} href="/tracker">
              <span className={styles.actionIcon}>
                <MapPinned size={17} />
              </span>
              <span className={styles.actionCopy}>
                <strong>Track trucks & skids</strong>
                <small>View location and availability</small>
              </span>
              <ArrowUpRight size={15} />
            </Link>
            <Link className={styles.actionCard} href="/plant-report">
              <span className={styles.actionIcon}>
                <TruckIcon size={17} />
              </span>
              <span className={styles.actionCopy}>
                <strong>Record plant status</strong>
                <small>Update skids, trucks, and readings</small>
              </span>
              <ArrowUpRight size={15} />
            </Link>
            <Link className={styles.actionCard} href="/updates">
              <span className={styles.actionIcon}>
                <MessageSquareText size={17} />
              </span>
              <span className={styles.actionCopy}>
                <strong>View customer updates</strong>
                <small>See recent customer messages</small>
              </span>
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </section>

        <div className={styles.dashboardFooter}>
          <span>
            {lastChecked
              ? `Last successful refresh: ${formatTime(lastChecked)}`
              : 'Overview refreshes automatically every 30 seconds.'}
          </span>
          <span>Refresh interval: 30 seconds</span>
        </div>
      </main>
    </div>
  );
}
