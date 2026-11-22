'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Filter, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import {
  getPlantDashboard,
  submitPlantReport,
  updateSkidStatus,
} from '@/frontend/actions/plant-reports';
import { updateTruckPlantStatus } from '@/frontend/actions/trucks';
import type {
  PlantDashboardData,
  PlantReportMetrics,
  PlantYardSkid,
} from '@/frontend/types/plant-report';
import { usePlantStatusStore } from '@/frontend/store/plant-status-store';
import OperationsSidebar from './operations-sidebar';
import { useToast } from './toast-provider';
import styles from './plant-report-form.module.css';

type SkidFill = 'empty' | 'loading' | 'loaded' | 'on_hold';
type SkidBay = 'washing_bay' | 'loading_bay' | 'parking_bay';
type PlantStatusSection =
  'overview' | 'skids' | 'trucks' | 'pressures' | 'equipment' | 'compressors' | 'preview';
type SkidStatusDraft = {
  fillState: SkidFill;
  bay: SkidBay;
  note: string;
  isOnMaintenance: boolean;
  maintenanceNote: string;
};
type CompressorRow = { id: number; name: string; status: 'on' | 'off'; note: string };
type ExtraFieldRow = { id: number; name: string; value: string };
type TruckStatusDraft = {
  isStandby: boolean;
  isOnMaintenance: boolean;
  maintenanceNote: string;
  note: string;
};
type PlantTruck = PlantDashboardData['plantTrucks'][number];

function getSkidStatusDraft(skid: PlantYardSkid): SkidStatusDraft {
  return {
    fillState: skid.fillState ?? 'empty',
    bay: skid.fillState === 'loading' ? 'loading_bay' : (skid.bay ?? 'parking_bay'),
    note: skid.note ?? '',
    isOnMaintenance: skid.isOnMaintenance ?? false,
    maintenanceNote: skid.maintenanceNote ?? '',
  };
}

function hasSkidStatusChanges(skid: PlantYardSkid, status: SkidStatusDraft) {
  const original = getSkidStatusDraft(skid);
  return (
    status.fillState !== original.fillState ||
    status.bay !== original.bay ||
    status.note.trim() !== original.note.trim() ||
    status.isOnMaintenance !== original.isOnMaintenance ||
    status.maintenanceNote.trim() !== original.maintenanceNote.trim()
  );
}

function getTruckStatusDraft(truck: PlantTruck): TruckStatusDraft {
  return {
    isStandby: truck.isStandby ?? false,
    isOnMaintenance: truck.isOnMaintenance ?? false,
    maintenanceNote: truck.maintenanceNote ?? '',
    note: truck.note ?? '',
  };
}

function hasTruckStatusChanges(truck: PlantTruck, status: TruckStatusDraft) {
  const original = getTruckStatusDraft(truck);
  return (
    status.isStandby !== original.isStandby ||
    status.isOnMaintenance !== original.isOnMaintenance ||
    status.maintenanceNote.trim() !== original.maintenanceNote.trim() ||
    status.note.trim() !== original.note.trim()
  );
}

function countSkids(groups: { customer: string[]; gastech: string[] }) {
  return groups.customer.length + groups.gastech.length;
}

function formatReportDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function PlantReportForm() {
  const [activeSection, setActiveSection] = useState<PlantStatusSection>('overview');
  const [dashboard, setDashboard] = useState<PlantDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [truckSearch, setTruckSearch] = useState('');
  const [skidStatuses, setSkidStatuses] = useState<Record<string, SkidStatusDraft>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterFill, setFilterFill] = useState<SkidFill | ''>('');
  const [filterOwner, setFilterOwner] = useState<'customer' | 'gastech' | ''>('');
  const [filterBay, setFilterBay] = useState<SkidBay | ''>('');
  const [filterMaintenance, setFilterMaintenance] = useState<boolean | ''>('');
  const [filterNew, setFilterNew] = useState<boolean | ''>('');
  const [compressors, setCompressors] = useState<CompressorRow[]>([]);
  const [extraFields, setExtraFields] = useState<ExtraFieldRow[]>([]);
  const [truckStatuses, setTruckStatuses] = useState<Record<string, TruckStatusDraft>>({});
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const nextRowId = useRef(0);
  const showToast = useToast();

  const {
    officersOnDuty,
    metrics,
    formattedMessage,
    setOfficersOnDuty,
    setMetrics,
    setFormattedMessage,
  } = usePlantStatusStore();

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPlantDashboard();
      setDashboard(data);
      setTruckStatuses((current) => {
        if (Object.keys(current).length) return current;
        return Object.fromEntries(
          data.plantTrucks.map((truck) => [
            truck.id,
            {
              isStandby: truck.isStandby ?? false,
              isOnMaintenance: truck.isOnMaintenance ?? false,
              maintenanceNote: truck.maintenanceNote ?? '',
              note: truck.note ?? '',
            },
          ])
        );
      });
    } catch (loadError) {
      showToast({
        tone: 'error',
        title: 'Unable to load plant status',
        description: loadError instanceof Error ? loadError.message : 'Try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [loadStatus]);

  useEffect(() => {
    if (!dashboard) return;
    const initialMetrics = Object.keys(metrics).length
      ? metrics
      : (dashboard.latestReport?.metrics ?? {});
    setCompressors((current) =>
      current.length
        ? current
        : Array.from({ length: 10 }, (_, index) => {
            const name = `COMP ${index + 1}`;
            const saved = initialMetrics.compressors?.[name];
            const status: 'on' | 'off' = saved?.toLowerCase().startsWith('off') ? 'off' : 'on';
            const note = saved?.includes('(')
              ? saved.slice(saved.indexOf('(') + 1, saved.lastIndexOf(')')).trim()
              : '';
            return { id: nextRowId.current++, name, status, note };
          })
    );
    setExtraFields((current) =>
      current.length
        ? current
        : Object.entries(initialMetrics.extraFields ?? {}).map(([name, value]) => ({
            id: nextRowId.current++,
            name,
            value: String(value),
          }))
    );
  }, [dashboard, metrics]);

  useEffect(() => {
    const latestReport = dashboard?.latestReport;
    if (!latestReport) return;
    if (!officersOnDuty.trim()) setOfficersOnDuty(latestReport.officersOnDuty);
    if (!Object.keys(metrics).length && Object.keys(latestReport.metrics).length) {
      setMetrics(latestReport.metrics);
    }
  }, [dashboard?.latestReport, metrics, officersOnDuty, setMetrics, setOfficersOnDuty]);

  const filteredSkids = useMemo(() => {
    if (!dashboard) return [];
    if (!search.trim()) return [];
    const query = search.trim().toLowerCase();
    return dashboard.plantSkids.filter((skid) => {
      if (
        query &&
        !skid.skidNum.toLowerCase().includes(query) &&
        !skid.customerName?.toLowerCase().includes(query)
      )
        return false;
      if (filterFill && skid.fillState !== filterFill) return false;
      if (filterOwner && skid.owner !== filterOwner) return false;
      if (filterBay && skid.bay !== filterBay) return false;
      if (filterMaintenance !== '' && skid.isOnMaintenance !== filterMaintenance) return false;
      if (filterNew !== '' && skid.isNew !== filterNew) return false;
      return true;
    });
  }, [dashboard, search, filterFill, filterOwner, filterBay, filterMaintenance, filterNew]);

  const filteredPlantTrucks = useMemo(() => {
    const query = truckSearch.trim().toLowerCase();
    if (!dashboard || !query) return [];
    return dashboard.plantTrucks.filter((truck) => truck.truckNum.toLowerCase().includes(query));
  }, [dashboard, truckSearch]);

  async function recordSkidStatus(skid: PlantYardSkid, status: SkidStatusDraft) {
    if (saving || loading || !hasSkidStatusChanges(skid, status)) return;
    setSaving(true);
    try {
      await updateSkidStatus(skid.id, {
        fillState: status.fillState,
        bay: status.bay,
        isOnMaintenance: status.isOnMaintenance,
        maintenanceNote: status.maintenanceNote.trim() || null,
        note: status.note.trim() || null,
      });
      await loadStatus();
      showToast({ tone: 'success', title: `Skid ${skid.skidNum} status recorded` });
    } catch (saveError) {
      showToast({
        tone: 'error',
        title: 'Unable to record skid status',
        description: saveError instanceof Error ? saveError.message : 'Try again.',
      });
    } finally {
      setSaving(false);
    }
  }

  function clearFilters() {
    setFilterFill('');
    setFilterOwner('');
    setFilterBay('');
    setFilterMaintenance('');
    setFilterNew('');
  }

  function updateMetric(
    field: 'inletPressureBar' | 'loadingPressureBar' | 'newChassisInPlant',
    value: string
  ) {
    const parsed = value.trim() === '' ? undefined : Number(value);
    setMetrics({
      ...metrics,
      [field]: parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined,
    });
  }

  function updateGearbox(field: 'loadingAndWashingBay' | 'workshop' | 'wooden', value: string) {
    const parsed = value.trim() === '' ? undefined : Number(value);
    setMetrics({
      ...metrics,
      landingGearBox: {
        ...metrics.landingGearBox,
        [field]: parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined,
      },
    });
  }

  function buildMetrics(): PlantReportMetrics {
    const compressorMetrics = Object.fromEntries(
      compressors.map((row) => [
        row.name,
        row.note.trim()
          ? `${row.status === 'on' ? 'On' : 'Off'} (${row.note.trim()})`
          : row.status === 'on'
            ? 'On'
            : 'Off',
      ])
    );
    const extraMetrics = Object.fromEntries(
      extraFields.filter((row) => row.name.trim()).map((row) => [row.name.trim(), row.value.trim()])
    );
    return {
      ...metrics,
      compressors: Object.keys(compressorMetrics).length ? compressorMetrics : undefined,
      extraFields: Object.keys(extraMetrics).length ? extraMetrics : undefined,
    };
  }

  async function generateStatus() {
    if (saving) return;
    if (!officersOnDuty.trim()) {
      showToast({
        tone: 'error',
        title: 'Officer name required',
        description: 'Enter the logistics officer(s) on duty.',
      });
      setActiveSection('pressures');
      return;
    }
    setSaving(true);
    setCopied(false);
    try {
      const result = await submitPlantReport({
        officersOnDuty: officersOnDuty.trim(),
        metrics: buildMetrics(),
        skidUpdates: [],
      });
      setFormattedMessage(result.formattedMessage);
      await loadStatus();
      setActiveSection('preview');
      showToast({ tone: 'success', title: 'Plant status report recorded' });
    } catch (saveError) {
      showToast({
        tone: 'error',
        title: 'Unable to record plant status',
        description: saveError instanceof Error ? saveError.message : 'Try again.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function copyStatus() {
    if (copying) return;
    const message = dashboard?.latestReport?.formattedMessage ?? formattedMessage;
    if (!message) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      showToast({ tone: 'success', title: 'Plant status copied' });
    } catch (copyError) {
      showToast({
        tone: 'error',
        title: 'Unable to copy plant status',
        description: copyError instanceof Error ? copyError.message : 'Try again.',
      });
    } finally {
      setCopying(false);
    }
  }

  const snapshot = dashboard?.fleetSnapshot;
  const truckSummary = snapshot
    ? [
        { label: 'On ground', count: snapshot.trucksOnGround.length },
        { label: 'In transit', count: snapshot.trucksInTransit.length },
        { label: 'Returning', count: snapshot.returningTrucks.length },
        { label: 'Standby', count: snapshot.standbyTrucks.length },
        { label: 'Maintenance', count: snapshot.maintenance.trucks.length },
      ]
    : [];
  const skidSummary = snapshot
    ? [
        { label: 'Loading', count: countSkids(snapshot.skidsLoading) },
        { label: 'Loaded', count: countSkids(snapshot.skidsLoaded) },
        { label: 'Empty', count: countSkids(snapshot.skidsEmpty) },
        { label: 'On hold', count: snapshot.skidsOnHold.length },
        { label: 'Washing', count: snapshot.skidsForWashing.length },
        { label: 'New loaded', count: snapshot.newLoadedSkids.length },
        { label: 'Maintenance', count: snapshot.maintenance.skids.length },
      ]
    : [];

  return (
    <div className={styles.shell}>
      <OperationsSidebar active="plant-report" />
      <main className={styles.main}>
        <header className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>Plant operations</p>
            <h1 className={styles.title}>Plant status</h1>
            <p className={styles.subtitle}>Monitor plant inventory, fleet status, and readings.</p>
          </div>
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={() => void loadStatus()}
            disabled={loading || saving}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </header>

        <div className={styles.statusTabs} role="tablist" aria-label="Plant status section">
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'overview'}
            className={`${styles.statusTab} ${activeSection === 'overview' ? styles.statusTabActive : ''}`}
            onClick={() => setActiveSection('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'skids'}
            className={`${styles.statusTab} ${activeSection === 'skids' ? styles.statusTabActive : ''}`}
            onClick={() => setActiveSection('skids')}
          >
            Skids
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'trucks'}
            className={`${styles.statusTab} ${activeSection === 'trucks' ? styles.statusTabActive : ''}`}
            onClick={() => setActiveSection('trucks')}
          >
            Trucks
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'pressures'}
            className={`${styles.statusTab} ${activeSection === 'pressures' ? styles.statusTabActive : ''}`}
            onClick={() => setActiveSection('pressures')}
          >
            Pressure & officers
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'equipment'}
            className={`${styles.statusTab} ${activeSection === 'equipment' ? styles.statusTabActive : ''}`}
            onClick={() => setActiveSection('equipment')}
          >
            Plant equipment
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'compressors'}
            className={`${styles.statusTab} ${activeSection === 'compressors' ? styles.statusTabActive : ''}`}
            onClick={() => setActiveSection('compressors')}
          >
            Compressors
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'preview'}
            className={`${styles.statusTab} ${activeSection === 'preview' ? styles.statusTabActive : ''}`}
            onClick={() => setActiveSection('preview')}
          >
            Preview
          </button>
        </div>

        {activeSection === 'overview' ? (
          <div className={styles.plantDashboard}>
            <section className={styles.dashboardActions} aria-label="Plant status actions">
              <button
                type="button"
                className={styles.dashboardAction}
                onClick={() => void copyStatus()}
                disabled={
                  saving ||
                  copying ||
                  !(dashboard?.latestReport?.formattedMessage ?? formattedMessage)
                }
              >
                <span className={styles.dashboardActionIcon}>
                  <Copy size={17} />
                </span>
                <span className={styles.dashboardActionCopy}>
                  <strong>
                    {' '}
                    {copying
                      ? 'Copying plant status…'
                      : copied
                        ? 'Plant status copied'
                        : 'Copy latest plant status'}
                  </strong>
                  <small>
                    {dashboard?.latestReport
                      ? `Last recorded ${formatReportDate(dashboard.latestReport.createdAt)}`
                      : 'Save a report to enable copying.'}
                  </small>
                </span>
              </button>
              <button
                type="button"
                className={`${styles.dashboardAction} ${styles.dashboardActionPrimary}`}
                onClick={() => {
                  setCopied(false);
                  setActiveSection('skids');
                }}
              >
                <span className={styles.dashboardActionIcon}>
                  <Plus size={18} />
                </span>
                <span className={styles.dashboardActionCopy}>
                  <strong>Update plant status</strong>
                  <small>Update skids, trucks, and plant readings</small>
                </span>
              </button>
            </section>

            <section className={styles.snapshotPanel}>
              <header className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>Plant snapshot</h2>
                  <p className={styles.panelHint}>Truck activity and skid yard status.</p>
                </div>
              </header>
              {loading && !dashboard ? (
                <div className={styles.emptyState}>Loading plant snapshot…</div>
              ) : snapshot ? (
                <div className={styles.snapshotGroups}>
                  <section className={styles.snapshotGroup}>
                    <h3>Trucks</h3>
                    <div className={styles.snapshotMetricGrid}>
                      {truckSummary.map((item) => (
                        <div className={styles.snapshotMetric} key={item.label}>
                          <span>{item.label}</span>
                          <strong>{item.count}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className={styles.snapshotGroup}>
                    <h3>Skids</h3>
                    <div className={styles.snapshotMetricGrid}>
                      {skidSummary.map((item) => (
                        <div className={styles.snapshotMetric} key={item.label}>
                          <span>{item.label}</span>
                          <strong>{item.count}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              ) : (
                <div className={styles.emptyState}>Plant status is unavailable.</div>
              )}
              {dashboard?.latestReport ? (
                <div className={styles.latestReportNote}>
                  <span>Latest report · {formatReportDate(dashboard.latestReport.createdAt)}</span>
                  <strong>{dashboard.latestReport.officersOnDuty}</strong>
                  {dashboard.latestReport.metrics.inletPressureBar !== undefined ? (
                    <span>
                      Inlet pressure: {dashboard.latestReport.metrics.inletPressureBar} bar
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className={styles.latestReportNote}>
                  No plant status report has been recorded.
                </div>
              )}
            </section>
          </div>
        ) : activeSection === 'trucks' ? (
          <section className={styles.truckStatus}>
            <header className={styles.skidListHeader}>
              <strong>Trucks at plant</strong>
              <span>{filteredPlantTrucks.length} found</span>
            </header>
            <div className={styles.truckSearch}>
              <label htmlFor="truck-search">Search plant trucks</label>
              <input
                id="truck-search"
                value={truckSearch}
                onChange={(event) => setTruckSearch(event.target.value)}
                placeholder="Search by truck number"
              />
            </div>
            <div className={styles.truckList}>
              {loading ? (
                <div className={styles.emptyState}>Loading trucks…</div>
              ) : !truckSearch.trim() ? (
                <div className={styles.emptyState}>Search for a truck to update its status.</div>
              ) : filteredPlantTrucks.length ? (
                filteredPlantTrucks.map((truck) => {
                  const status = truckStatuses[truck.id] ?? getTruckStatusDraft(truck);
                  const hasChanges = hasTruckStatusChanges(truck, status);
                  return (
                    <article className={styles.truckRow} key={truck.id}>
                      <div className={styles.truckIdentity}>
                        <strong>{truck.truckNum}</strong>
                        <span>{truck.currentLoc}</span>
                      </div>
                      <div className={styles.truckToggles}>
                        <label>
                          Standby
                          <button
                            type="button"
                            role="switch"
                            aria-checked={status.isStandby}
                            aria-label={`${truck.truckNum} standby`}
                            disabled={saving || loading}
                            className={`${styles.toggle} ${status.isStandby ? styles.toggleOn : ''}`}
                            onClick={() =>
                              setTruckStatuses((current) => ({
                                ...current,
                                [truck.id]: { ...status, isStandby: !status.isStandby },
                              }))
                            }
                          >
                            <span />
                          </button>
                        </label>
                        <label>
                          Maintenance
                          <button
                            type="button"
                            role="switch"
                            aria-checked={status.isOnMaintenance}
                            aria-label={`${truck.truckNum} maintenance`}
                            disabled={saving || loading}
                            className={`${styles.toggle} ${status.isOnMaintenance ? styles.toggleOn : ''}`}
                            onClick={() =>
                              setTruckStatuses((current) => ({
                                ...current,
                                [truck.id]: { ...status, isOnMaintenance: !status.isOnMaintenance },
                              }))
                            }
                          >
                            <span />
                          </button>
                        </label>
                      </div>
                      {status.isOnMaintenance ? (
                        <input
                          className={styles.truckMaintenanceNote}
                          aria-label={`${truck.truckNum} maintenance note`}
                          value={status.maintenanceNote}
                          disabled={saving || loading}
                          onChange={(event) =>
                            setTruckStatuses((current) => ({
                              ...current,
                              [truck.id]: { ...status, maintenanceNote: event.target.value },
                            }))
                          }
                          placeholder="Enter maintenance details"
                        />
                      ) : null}
                      <button
                        type="button"
                        className={`${styles.recordButton} ${styles.truckRecordButton}`}
                        disabled={saving || loading || !hasChanges}
                        onClick={async () => {
                          if (saving || loading || !hasChanges) return;
                          setSaving(true);
                          try {
                            await updateTruckPlantStatus(truck.id, {
                              isStandby: status.isStandby,
                              isOnMaintenance: status.isOnMaintenance,
                              maintenanceNote: status.maintenanceNote.trim() || null,
                              note: status.note.trim() || null,
                            });
                            await loadStatus();
                            showToast({
                              tone: 'success',
                              title: `Truck ${truck.truckNum} status recorded`,
                            });
                          } catch (saveError) {
                            showToast({
                              tone: 'error',
                              title: 'Unable to record truck status',
                              description:
                                saveError instanceof Error ? saveError.message : 'Try again.',
                            });
                          } finally {
                            setSaving(false);
                          }
                        }}
                      >
                        <Save size={13} /> Save status
                      </button>
                    </article>
                  );
                })
              ) : (
                <div className={styles.emptyState}>No matching plant trucks.</div>
              )}
            </div>
          </section>
        ) : activeSection === 'skids' ? (
          <section className={styles.skidListPanel}>
            <div className={styles.skidListHeader}>
              <strong>Plant skids</strong>
              <span>{filteredSkids.length} found</span>
            </div>
            <div className={styles.skidToolbar}>
              <div className={styles.skidSearchControl}>
                <label htmlFor="plant-skid-search">Search plant skids</label>
                <input
                  id="plant-skid-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search skid number or customer"
                />
              </div>
              <button
                type="button"
                className={styles.skidFilterButton}
                onClick={() => setFiltersOpen((open) => !open)}
                aria-label="Filter skids"
                aria-expanded={filtersOpen}
              >
                <Filter size={15} />
              </button>
            </div>

            {filtersOpen ? (
              <div className={styles.filterPanel}>
                <select
                  value={filterFill}
                  onChange={(event) => setFilterFill(event.target.value as SkidFill)}
                >
                  <option value="">All fill states</option>
                  <option value="empty">Empty</option>
                  <option value="loading">Loading</option>
                  <option value="loaded">Loaded</option>
                  <option value="on_hold">On hold</option>
                </select>
                <select
                  value={filterOwner}
                  onChange={(event) =>
                    setFilterOwner(event.target.value as 'customer' | 'gastech' | '')
                  }
                >
                  <option value="">All owners</option>
                  <option value="gastech">Gastech</option>
                  <option value="customer">Customer</option>
                </select>
                <select
                  value={filterBay}
                  onChange={(event) => setFilterBay(event.target.value as SkidBay)}
                >
                  <option value="">All bays</option>
                  <option value="washing_bay">Washing</option>
                  <option value="loading_bay">Loading</option>
                  <option value="parking_bay">Parking</option>
                </select>
                <select
                  value={filterMaintenance === '' ? '' : filterMaintenance ? 'yes' : 'no'}
                  onChange={(event) =>
                    setFilterMaintenance(
                      event.target.value === '' ? '' : event.target.value === 'yes'
                    )
                  }
                >
                  <option value="">All maintenance statuses</option>
                  <option value="no">Not in maintenance</option>
                  <option value="yes">In maintenance</option>
                </select>
                <select
                  value={filterNew === '' ? '' : filterNew ? 'yes' : 'no'}
                  onChange={(event) =>
                    setFilterNew(event.target.value === '' ? '' : event.target.value === 'yes')
                  }
                >
                  <option value="">All skid types</option>
                  <option value="no">Existing skids</option>
                  <option value="yes">New skids</option>
                </select>
                <button type="button" className={styles.buttonSecondary} onClick={clearFilters}>
                  Clear
                </button>
              </div>
            ) : null}

            <div className={styles.skidList}>
              {loading ? (
                <div className={styles.emptyState}>Loading skids…</div>
              ) : !search.trim() ? (
                <div className={styles.emptyState}>Search for a skid to update its status.</div>
              ) : filteredSkids.length ? (
                filteredSkids.map((skid) => {
                  const status = skidStatuses[skid.id] ?? getSkidStatusDraft(skid);
                  const hasChanges = hasSkidStatusChanges(skid, status);

                  return (
                    <article className={styles.skidRow} key={skid.id}>
                      <div className={styles.skidRowMain}>
                        <div className={styles.skidIdentity}>
                          <strong>{skid.skidNum}</strong>
                          <span>
                            {skid.owner === 'customer' && skid.customerName
                              ? skid.customerName
                              : skid.owner}
                            {skid.isNew ? ' · New' : ''}
                          </span>
                        </div>
                        <div className={styles.skidField}>
                          <label htmlFor={`skid-fill-${skid.id}`}>Fill state</label>
                          <select
                            id={`skid-fill-${skid.id}`}
                            value={status.fillState}
                            disabled={saving || loading || !hasChanges}
                            onChange={(event) => {
                              const fillState = event.target.value as SkidFill;
                              setSkidStatuses((current) => ({
                                ...current,
                                [skid.id]: {
                                  ...status,
                                  fillState,
                                  ...(fillState === 'loading' ? { bay: 'loading_bay' } : {}),
                                },
                              }));
                            }}
                          >
                            <option value="empty">Empty</option>
                            <option value="loading">Loading</option>
                            <option value="loaded">Loaded</option>
                            <option value="on_hold">On hold</option>
                          </select>
                        </div>
                        <div className={styles.skidField}>
                          <label htmlFor={`skid-bay-${skid.id}`}>Bay</label>
                          <select
                            id={`skid-bay-${skid.id}`}
                            value={status.bay}
                            disabled={saving || loading || status.fillState === 'loading'}
                            onChange={(event) =>
                              setSkidStatuses((current) => ({
                                ...current,
                                [skid.id]: {
                                  ...status,
                                  bay: event.target.value as SkidBay,
                                },
                              }))
                            }
                          >
                            <option value="washing_bay">Washing</option>
                            <option value="loading_bay">Loading</option>
                            <option value="parking_bay">Parking</option>
                          </select>
                        </div>
                        <div className={styles.skidField}>
                          <label htmlFor={`skid-note-${skid.id}`}>Note</label>
                          <input
                            id={`skid-note-${skid.id}`}
                            value={status.note}
                            disabled={saving || loading}
                            onChange={(event) =>
                              setSkidStatuses((current) => ({
                                ...current,
                                [skid.id]: { ...status, note: event.target.value },
                              }))
                            }
                            placeholder="Add skid notes"
                          />
                        </div>
                        <div className={styles.skidMaintenance}>
                          <span>Maintenance</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={status.isOnMaintenance}
                            aria-label={`${skid.skidNum} maintenance`}
                            disabled={saving || loading}
                            className={`${styles.toggle} ${status.isOnMaintenance ? styles.toggleOn : ''}`}
                            onClick={() =>
                              setSkidStatuses((current) => ({
                                ...current,
                                [skid.id]: {
                                  ...status,
                                  isOnMaintenance: !status.isOnMaintenance,
                                },
                              }))
                            }
                          >
                            <span />
                          </button>
                        </div>
                        <button
                          type="button"
                          className={`${styles.recordButton} ${styles.skidRecordButton}`}
                          disabled={saving || loading}
                          onClick={() => void recordSkidStatus(skid, status)}
                        >
                          <Save size={13} /> Save status
                        </button>
                      </div>
                      {status.isOnMaintenance ? (
                        <textarea
                          className={styles.skidMaintenanceNote}
                          aria-label={`${skid.skidNum} maintenance note`}
                          value={status.maintenanceNote}
                          disabled={saving || loading}
                          onChange={(event) =>
                            setSkidStatuses((current) => ({
                              ...current,
                              [skid.id]: { ...status, maintenanceNote: event.target.value },
                            }))
                          }
                          placeholder="Enter maintenance details"
                          rows={3}
                        />
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <div className={styles.emptyState}>No matching plant skids.</div>
              )}
            </div>
          </section>
        ) : activeSection === 'pressures' ? (
          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Pressure & officers</h2>
                <p className={styles.panelHint}>Record current readings and duty officers.</p>
              </div>
            </header>
            <div className={styles.panelBody}>
              <div className={styles.fieldGrid}>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label htmlFor="officers">
                    Officers on duty <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="officers"
                    value={officersOnDuty}
                    onChange={(event) => setOfficersOnDuty(event.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="inlet-pressure">Inlet pressure (bar)</label>
                  <input
                    id="inlet-pressure"
                    type="number"
                    step="any"
                    value={metrics.inletPressureBar ?? ''}
                    onChange={(event) => updateMetric('inletPressureBar', event.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="loading-pressure">Skid loading pressure (bar)</label>
                  <input
                    id="loading-pressure"
                    type="number"
                    step="any"
                    value={metrics.loadingPressureBar ?? ''}
                    onChange={(event) => updateMetric('loadingPressureBar', event.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          </section>
        ) : activeSection === 'equipment' ? (
          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Plant equipment</h2>
                <p className={styles.panelHint}>Track chassis and gearbox inventory.</p>
              </div>
            </header>
            <div className={styles.panelBody}>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label htmlFor="new-chassis">New chassis in plant</label>
                  <input
                    id="new-chassis"
                    type="number"
                    step="1"
                    value={metrics.newChassisInPlant ?? ''}
                    onChange={(event) => updateMetric('newChassisInPlant', event.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="loading-bay-gear">Loading & washing bay gearboxes</label>
                  <input
                    id="loading-bay-gear"
                    type="number"
                    step="1"
                    value={metrics.landingGearBox?.loadingAndWashingBay ?? ''}
                    onChange={(event) => updateGearbox('loadingAndWashingBay', event.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="workshop-gear">Workshop gearboxes</label>
                  <input
                    id="workshop-gear"
                    type="number"
                    step="1"
                    value={metrics.landingGearBox?.workshop ?? ''}
                    onChange={(event) => updateGearbox('workshop', event.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="wooden-gear">Wooden gearboxes</label>
                  <input
                    id="wooden-gear"
                    type="number"
                    step="1"
                    value={metrics.landingGearBox?.wooden ?? ''}
                    onChange={(event) => updateGearbox('wooden', event.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className={styles.subsection}>
                <div className={styles.subsectionHeader}>
                  <h3 className={styles.subsectionTitle}>Additional fields</h3>
                  <button
                    type="button"
                    className={styles.buttonSecondary}
                    onClick={() =>
                      setExtraFields((rows) => [
                        ...rows,
                        { id: nextRowId.current++, name: '', value: '' },
                      ])
                    }
                  >
                    <Plus size={13} /> Add field
                  </button>
                </div>
                {extraFields.map((row) => (
                  <div className={styles.dynamicRow} key={row.id}>
                    <input
                      value={row.name}
                      onChange={(event) =>
                        setExtraFields((rows) =>
                          rows.map((item) =>
                            item.id === row.id ? { ...item, name: event.target.value } : item
                          )
                        )
                      }
                      placeholder="Metric name"
                    />
                    <input
                      value={row.value}
                      onChange={(event) =>
                        setExtraFields((rows) =>
                          rows.map((item) =>
                            item.id === row.id ? { ...item, value: event.target.value } : item
                          )
                        )
                      }
                      placeholder="Enter metric value"
                    />
                    <button
                      type="button"
                      className={styles.buttonDanger}
                      onClick={() =>
                        setExtraFields((rows) => rows.filter((item) => item.id !== row.id))
                      }
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : activeSection === 'compressors' ? (
          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Working compressors</h2>
                <p className={styles.panelHint}>
                  Set each compressor on or off and add an optional note.
                </p>
              </div>
            </header>
            <div className={styles.panelBody}>
              <div className={styles.compressorGrid}>
                {compressors.map((row) => (
                  <div className={styles.compressorRow} key={row.id}>
                    <strong>{row.name}</strong>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={row.status === 'on'}
                      aria-label={`${row.name} ${row.status === 'on' ? 'on' : 'off'}`}
                      className={`${styles.toggle} ${row.status === 'on' ? styles.toggleOn : ''}`}
                      onClick={() =>
                        setCompressors((rows) =>
                          rows.map((item) =>
                            item.id === row.id
                              ? { ...item, status: item.status === 'on' ? 'off' : 'on' }
                              : item
                          )
                        )
                      }
                    >
                      <span />
                    </button>
                    <span className={styles.toggleState}>{row.status === 'on' ? 'On' : 'Off'}</span>
                    <input
                      value={row.note}
                      onChange={(event) =>
                        setCompressors((rows) =>
                          rows.map((item) =>
                            item.id === row.id ? { ...item, note: event.target.value } : item
                          )
                        )
                      }
                      placeholder="Add note (optional)"
                      aria-label={`${row.name} optional note`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Record plant status</h2>
                <p className={styles.panelHint}>
                  Save the report and review its copy-ready WhatsApp message.
                </p>
              </div>
              <button
                type="button"
                className={styles.button}
                onClick={() => void generateStatus()}
                disabled={saving}
              >
                {saving ? <RefreshCw size={14} /> : <Save size={14} />}
                {saving ? 'Saving…' : 'Save plant status'}
              </button>
            </header>
            <div className={styles.panelBody}>
              {formattedMessage ? (
                <>
                  <pre className={styles.resultBody}>{formattedMessage}</pre>
                  <button
                    type="button"
                    className={styles.copyButton}
                    onClick={() => void copyStatus()}
                    disabled={copying}
                  >
                    <Copy size={13} />
                    {copying ? 'Copying…' : copied ? 'Copied' : 'Copy text'}
                  </button>
                </>
              ) : (
                <div className={styles.emptyState}>
                  Save the report to generate the WhatsApp summary.
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
