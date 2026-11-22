'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  Box,
  Clock3,
  ListFilter,
  MapPin,
  MapPinned,
  RefreshCw,
  Search,
  Truck,
} from 'lucide-react';
import { getTrackerData } from '@/frontend/actions/tracker';
import type { SkidTrackerItem, TrackerData, TruckTrackerItem } from '@/frontend/types/tracker';
import OperationsSidebar from './operations-sidebar';
import styles from './truck-skid-tracker.module.css';

const REFRESH_INTERVAL_MS = 30_000;
type TrackerView = 'overview' | 'trucks' | 'skids';

function formatTime(value: Date | null) {
  if (!value) return 'Waiting for first refresh';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    value
  );
}

function formatLocation(location: string) {
  return location.trim() && location.toLowerCase() !== 'pending' ? location : 'Location pending';
}

function normalizeLocation(location: string) {
  return formatLocation(location).toLowerCase();
}

function truckAvailability(truck: TruckTrackerItem) {
  if (truck.isOnMaintenance || truck.status === 'maintenance') return 'maintenance';
  if (truck.isStandby || truck.status === 'standby') return 'standby';
  if (truck.activeMovement?.direction === 'inbound') return 'returning';
  if (truck.activeMovement) return 'in_transit';
  return truck.status;
}

function skidAvailability(skid: SkidTrackerItem) {
  return skid.isOnMaintenance || skid.status === 'maintenance' ? 'maintenance' : skid.status;
}

function statusLabel(status: string) {
  const label = status.replaceAll('_', ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function statusClass(status: string) {
  if (status === 'available' || status === 'loaded' || status === 'idle') {
    return styles.statusGreen;
  }
  if (
    status === 'in_transit' ||
    status === 'returning' ||
    status === 'loading' ||
    status === 'at_customer'
  ) {
    return styles.statusBlue;
  }
  if (status === 'standby' || status === 'maintenance' || status === 'on_hold') {
    return styles.statusAmber;
  }
  return styles.statusNeutral;
}

function summarizeLocations(items: { currentLoc: string }[]) {
  const locations = new Map<string, { label: string; count: number }>();
  for (const item of items) {
    const label = formatLocation(item.currentLoc);
    const key = normalizeLocation(item.currentLoc);
    const current = locations.get(key);
    if (current) current.count += 1;
    else locations.set(key, { label, count: 1 });
  }
  return [...locations.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label)
  );
}

function LocationBoard({
  title,
  icon,
  items,
}: {
  title: string;
  icon: ReactNode;
  items: { currentLoc: string }[];
}) {
  const locations = summarizeLocations(items);
  const maxCount = Math.max(...locations.map((item) => item.count), 1);

  return (
    <section className={styles.locationPanel}>
      <header className={styles.panelHeader}>
        <div className={styles.panelHeading}>
          <span className={styles.panelIcon}>{icon}</span>
          <div>
            <h2 className={styles.panelTitle}>{title}</h2>
            <p className={styles.panelSubtitle}>
              {locations.length} {locations.length === 1 ? 'location' : 'locations'} ·{' '}
              {items.length} assets
            </p>
          </div>
        </div>
        <MapPin size={16} />
      </header>
      {locations.length ? (
        <div className={styles.locationRows}>
          {locations.map((location) => (
            <div className={styles.locationRow} key={location.label.toLowerCase()}>
              <span className={styles.locationName} title={location.label}>
                {location.label}
              </span>
              <span className={styles.locationTrack}>
                <span style={{ width: `${(location.count / maxCount) * 100}%` }} />
              </span>
              <strong>{location.count}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>No assets are registered yet.</div>
      )}
    </section>
  );
}

function Overview({
  data,
  onSelect,
}: {
  data: TrackerData;
  onSelect: (view: 'trucks' | 'skids') => void;
}) {
  const plantTruckCount = data.trucks.filter(
    (truck) => normalizeLocation(truck.currentLoc) === 'gastech plant'
  ).length;
  const plantSkidCount = data.skids.filter(
    (skid) => normalizeLocation(skid.currentLoc) === 'gastech plant'
  ).length;
  const movingTruckCount = data.trucks.filter((truck) => truck.activeMovement !== null).length;
  const maintenanceCount =
    data.trucks.filter((truck) => truckAvailability(truck) === 'maintenance').length +
    data.skids.filter((skid) => skidAvailability(skid) === 'maintenance').length;

  return (
    <>
      <section className={styles.metricGrid} aria-label="Fleet snapshot">
        <article className={styles.metricCard}>
          <span className={styles.metricIcon}>
            <Truck size={17} />
          </span>
          <span className={styles.metricLabel}>Trucks at plant</span>
          <strong>{plantTruckCount}</strong>
          <small>of {data.trucks.length} tracked trucks</small>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricIcon}>
            <Box size={17} />
          </span>
          <span className={styles.metricLabel}>Skids at plant</span>
          <strong>{plantSkidCount}</strong>
          <small>of {data.skids.length} registered skids</small>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricIcon}>
            <Activity size={17} />
          </span>
          <span className={styles.metricLabel}>Trucks in transit</span>
          <strong>{movingTruckCount}</strong>
          <small>Current fleet status</small>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricIcon}>
            <Clock3 size={17} />
          </span>
          <span className={styles.metricLabel}>Assets on maintenance</span>
          <strong>{maintenanceCount}</strong>
          <small>Trucks and skids combined</small>
        </article>
      </section>

      <div className={styles.locationBoards}>
        <LocationBoard title="Truck locations" icon={<Truck size={16} />} items={data.trucks} />
        <LocationBoard title="Skid locations" icon={<Box size={16} />} items={data.skids} />
      </div>

      <section className={styles.overviewActions}>
        <div>
          <h2 className={styles.panelTitle}>Track a specific asset</h2>
          <p className={styles.panelSubtitle}>
            Search its latest location and operational details.
          </p>
        </div>
        <div className={styles.overviewButtons}>
          <button type="button" className={styles.primaryButton} onClick={() => onSelect('trucks')}>
            <Truck size={15} /> Find a truck
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => onSelect('skids')}
          >
            <Box size={15} /> Find a skid
          </button>
        </div>
      </section>
    </>
  );
}

function TruckDetails({ truck }: { truck: TruckTrackerItem }) {
  const availability = truckAvailability(truck);
  const coordinatesAreValid =
    Number.isFinite(truck.lat) &&
    Number.isFinite(truck.lon) &&
    truck.lat >= -90 &&
    truck.lat <= 90 &&
    truck.lon >= -180 &&
    truck.lon <= 180 &&
    (truck.lat !== 0 || truck.lon !== 0);
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${truck.lat},${truck.lon}`;

  return (
    <aside className={styles.detailPanel}>
      <header className={styles.detailHeader}>
        <div>
          <span className={styles.detailEyebrow}>Truck details</span>
          <h2>{truck.truckNum}</h2>
          {truck.slugNum ? <p>{truck.slugNum}</p> : null}
        </div>
        <span className={`${styles.statusPill} ${statusClass(availability)}`}>
          {statusLabel(availability)}
        </span>
      </header>
      <div className={styles.primaryLocation}>
        <MapPinned size={17} />
        <div>
          <span>Last known location</span>
          <strong>{formatLocation(truck.currentLoc)}</strong>
          {truck.geofence ? <small>Inside {truck.geofence}</small> : null}
        </div>
      </div>
      <div className={styles.detailMetrics}>
        <div>
          <span>Speed</span>
          <strong>{truck.speed.toLocaleString()} km/h</strong>
        </div>
        <div>
          <span>Availability</span>
          <strong>{statusLabel(availability)}</strong>
        </div>
        <div>
          <span>Coordinates</span>
          <strong>
            {coordinatesAreValid
              ? `${truck.lat.toFixed(5)}, ${truck.lon.toFixed(5)}`
              : 'Unavailable'}
          </strong>
        </div>
        <div>
          <span>Standby</span>
          <strong>{truck.isStandby || truck.status === 'standby' ? 'Yes' : 'No'}</strong>
        </div>
      </div>
      {truck.activeMovement ? (
        <div className={styles.movementDetails}>
          <strong>
            {truck.activeMovement.type === 'pickup' ? 'Pickup' : 'Dispatch'}{' '}
            {truck.activeMovement.direction === 'inbound' ? '· Returning' : '· Outbound'}
          </strong>
          <span>
            {truck.activeMovement.customerName ?? 'Customer unavailable'} · Trip{' '}
            {truck.activeMovement.tripStatus?.replaceAll('_', ' ') ?? 'not detected'}
          </span>
          <span>
            Outgoing skid: {truck.activeMovement.skidNumOut ?? 'None'} · Returned skid:{' '}
            {truck.activeMovement.skidNumIn ?? 'Not recorded'}
          </span>
          <small>Started {formatTime(new Date(truck.activeMovement.startedAt))}</small>
        </div>
      ) : null}
      {truck.maintenanceNote || truck.note ? (
        <div className={styles.detailNote}>
          {truck.maintenanceNote ? (
            <p>
              <strong>Maintenance note:</strong> {truck.maintenanceNote}
            </p>
          ) : null}
          {truck.note ? (
            <p>
              <strong>Note:</strong> {truck.note}
            </p>
          ) : null}
        </div>
      ) : null}
      {coordinatesAreValid ? (
        <a className={styles.mapLink} href={mapUrl} target="_blank" rel="noreferrer">
          <MapPin size={14} /> Open location in Maps
        </a>
      ) : (
        <div className={styles.detailHint}>
          No usable GPS coordinates are available for this truck.
        </div>
      )}
    </aside>
  );
}

function SkidDetails({ skid }: { skid: SkidTrackerItem }) {
  const availability = skidAvailability(skid);

  return (
    <aside className={styles.detailPanel}>
      <header className={styles.detailHeader}>
        <div>
          <span className={styles.detailEyebrow}>Skid details</span>
          <h2>{skid.skidNum}</h2>
          {skid.slugNum ? <p>{skid.slugNum}</p> : null}
        </div>
        <span className={`${styles.statusPill} ${statusClass(availability)}`}>
          {statusLabel(availability)}
        </span>
      </header>
      <div className={styles.primaryLocation}>
        <MapPinned size={17} />
        <div>
          <span>Last recorded location</span>
          <strong>{formatLocation(skid.currentLoc)}</strong>
          {skid.customerName ? <small>{skid.customerName}</small> : null}
        </div>
      </div>
      <div className={styles.detailMetrics}>
        <div>
          <span>Fill state</span>
          <strong>{skid.fillState ? statusLabel(skid.fillState) : 'Not recorded'}</strong>
        </div>
        <div>
          <span>Yard bay</span>
          <strong>{skid.bay ? statusLabel(skid.bay) : 'Not recorded'}</strong>
        </div>
        <div>
          <span>Owner</span>
          <strong>{statusLabel(skid.owner)}</strong>
        </div>
        <div>
          <span>New skid</span>
          <strong>{skid.isNew ? 'Yes' : 'No'}</strong>
        </div>
      </div>
      {skid.maintenanceNote || skid.note ? (
        <div className={styles.detailNote}>
          {skid.maintenanceNote ? (
            <p>
              <strong>Maintenance note:</strong> {skid.maintenanceNote}
            </p>
          ) : null}
          {skid.note ? (
            <p>
              <strong>Note:</strong> {skid.note}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className={styles.detailHint}>Skids do not report live GPS coordinates.</div>
    </aside>
  );
}

export default function TruckSkidTracker() {
  const [data, setData] = useState<TrackerData | null>(null);
  const [view, setView] = useState<TrackerView>('overview');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [selectedSkidId, setSelectedSkidId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      setData(await getTrackerData());
      setError(null);
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load truck and skid data.'
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(true), 0);
    const refreshTimer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, [refresh]);

  const filteredTrucks = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    return data.trucks.filter((truck) => {
      const matchesSearch = [
        truck.truckNum,
        truck.slugNum ?? '',
        truck.currentLoc,
        truck.geofence ?? '',
        truckAvailability(truck),
        truck.activeMovement?.direction ?? '',
        truck.activeMovement?.customerName ?? '',
        truck.activeMovement?.skidNumOut ?? '',
        truck.maintenanceNote ?? '',
        truck.note ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
      return (
        matchesSearch &&
        (statusFilter === 'all' || truckAvailability(truck) === statusFilter) &&
        (locationFilter === 'all' || normalizeLocation(truck.currentLoc) === locationFilter)
      );
    });
  }, [data, locationFilter, search, statusFilter]);

  const filteredSkids = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    return data.skids.filter((skid) => {
      const matchesSearch = [
        skid.skidNum,
        skid.slugNum ?? '',
        skid.currentLoc,
        skid.customerName ?? '',
        skidAvailability(skid),
        skid.fillState ?? '',
        skid.bay ?? '',
        skid.maintenanceNote ?? '',
        skid.note ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
      return (
        matchesSearch &&
        (statusFilter === 'all' || skidAvailability(skid) === statusFilter) &&
        (locationFilter === 'all' || normalizeLocation(skid.currentLoc) === locationFilter)
      );
    });
  }, [data, locationFilter, search, statusFilter]);

  const locations =
    view === 'trucks'
      ? summarizeLocations(data?.trucks ?? [])
      : summarizeLocations(data?.skids ?? []);
  const hasActiveFilters = statusFilter !== 'all' || locationFilter !== 'all';

  const selectedTruck =
    filteredTrucks.find((truck) => truck.id === selectedTruckId) ?? filteredTrucks[0] ?? null;
  const selectedSkid =
    filteredSkids.find((skid) => skid.id === selectedSkidId) ?? filteredSkids[0] ?? null;

  return (
    <div className={styles.shell}>
      <OperationsSidebar active="tracker" />
      <main className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.breadcrumb}>
            <span>Operations</span>
            <span>/</span>
            <strong>Truck & skid tracker</strong>
          </div>
          <div className={styles.refreshInfo}>
            <span className={`${styles.liveDot} ${error ? styles.liveDotError : ''}`} />
            {error ? 'Tracker refresh failed' : `Updated ${formatTime(lastUpdated)}`}
          </div>
        </div>

        <header className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>Fleet visibility</p>
            <h1 className={styles.title}>Truck & skid tracker</h1>
            <p className={styles.subtitle}>
              Check where assets are, their current availability, and the latest truck telemetry.
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
            {data ? `Refresh failed: ${error}. Showing the last loaded data.` : error}
          </div>
        ) : null}

        <div className={styles.toolbar}>
          <div className={styles.viewTabs} role="tablist" aria-label="Tracker view">
            {(['overview', 'trucks', 'skids'] as const).map((tab) => (
              <button
                type="button"
                role="tab"
                aria-selected={view === tab}
                className={`${styles.viewTab} ${view === tab ? styles.viewTabActive : ''}`}
                key={tab}
                onClick={() => {
                  setView(tab);
                  setSearch('');
                  setStatusFilter('all');
                  setLocationFilter('all');
                }}
              >
                {tab === 'overview' ? 'Location overview' : tab === 'trucks' ? 'Trucks' : 'Skids'}
              </button>
            ))}
          </div>
          {view !== 'overview' ? (
            <label className={styles.searchBox}>
              <Search size={15} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label={`Search ${view}`}
                placeholder={`Search ${view} by number, location, or status`}
              />
            </label>
          ) : null}
        </div>

        {view !== 'overview' ? (
          <div className={styles.filterBar}>
            <div className={styles.filterHeading}>
              <ListFilter size={14} />
              <span>Filter by</span>
            </div>
            <label className={styles.filterControl}>
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                {(view === 'trucks'
                  ? [
                      'available',
                      'in_transit',
                      'returning',
                      'standby',
                      'at_customer',
                      'maintenance',
                    ]
                  : ['available', 'in_transit', 'at_customer', 'maintenance']
                ).map((status) => (
                  <option value={status} key={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.filterControl}>
              <span>Location</span>
              <select
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
              >
                <option value="all">All locations</option>
                {locations.map((location) => (
                  <option value={normalizeLocation(location.label)} key={location.label}>
                    {location.label} ({location.count})
                  </option>
                ))}
              </select>
            </label>
            {hasActiveFilters ? (
              <button
                className={styles.clearFilters}
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setLocationFilter('all');
                }}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : null}

        {loading && !data ? (
          <div className={styles.loadingState}>
            <RefreshCw size={18} className="animate-spin" />
            Loading fleet and inventory data…
          </div>
        ) : !data ? (
          <div className={styles.emptyState}>Tracker data is unavailable.</div>
        ) : view === 'overview' ? (
          <Overview data={data} onSelect={setView} />
        ) : view === 'trucks' ? (
          <div className={styles.trackerLayout}>
            <section className={styles.assetListPanel}>
              <header className={styles.listHeader}>
                <div>
                  <h2>Trucks</h2>
                  <p>
                    {filteredTrucks.length} of {data.trucks.length} trucks
                  </p>
                </div>
                <Truck size={17} />
              </header>
              <div className={styles.assetList}>
                {filteredTrucks.length ? (
                  filteredTrucks.map((truck) => {
                    const availability = truckAvailability(truck);
                    return (
                      <button
                        type="button"
                        className={`${styles.assetRow} ${selectedTruck?.id === truck.id ? styles.assetRowActive : ''}`}
                        key={truck.id}
                        onClick={() => setSelectedTruckId(truck.id)}
                      >
                        <span className={styles.assetIdentity}>
                          <strong>{truck.truckNum}</strong>
                          <small>{formatLocation(truck.currentLoc)}</small>
                        </span>
                        <span className={styles.assetMeta}>
                          <span className={`${styles.statusPill} ${statusClass(availability)}`}>
                            {statusLabel(availability)}
                          </span>
                          <small>{truck.speed.toLocaleString()} km/h</small>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className={styles.emptyState}>No trucks match that search.</div>
                )}
              </div>
            </section>
            {selectedTruck ? (
              <TruckDetails truck={selectedTruck} />
            ) : (
              <div className={styles.emptyState}>Select a truck to view its details.</div>
            )}
          </div>
        ) : (
          <div className={styles.trackerLayout}>
            <section className={styles.assetListPanel}>
              <header className={styles.listHeader}>
                <div>
                  <h2>Skids</h2>
                  <p>
                    {filteredSkids.length} of {data.skids.length} skids
                  </p>
                </div>
                <Box size={17} />
              </header>
              <div className={styles.assetList}>
                {filteredSkids.length ? (
                  filteredSkids.map((skid) => {
                    const availability = skidAvailability(skid);
                    return (
                      <button
                        type="button"
                        className={`${styles.assetRow} ${selectedSkid?.id === skid.id ? styles.assetRowActive : ''}`}
                        key={skid.id}
                        onClick={() => setSelectedSkidId(skid.id)}
                      >
                        <span className={styles.assetIdentity}>
                          <strong>{skid.skidNum}</strong>
                          <small>{formatLocation(skid.currentLoc)}</small>
                        </span>
                        <span className={styles.assetMeta}>
                          <span className={`${styles.statusPill} ${statusClass(availability)}`}>
                            {statusLabel(availability)}
                          </span>
                          <small>
                            {skid.fillState ? statusLabel(skid.fillState) : 'No fill state'}
                          </small>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className={styles.emptyState}>No skids match that search.</div>
                )}
              </div>
            </section>
            {selectedSkid ? (
              <SkidDetails skid={selectedSkid} />
            ) : (
              <div className={styles.emptyState}>Select a skid to view its details.</div>
            )}
          </div>
        )}

        <footer className={styles.freshnessNote}>
          Truck and skid records refresh every 30 seconds. Truck GPS update timestamps are not
          available, and skids report recorded yard locations rather than live coordinates.
        </footer>
      </main>
    </div>
  );
}
