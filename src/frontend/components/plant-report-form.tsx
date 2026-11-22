'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
import styles from './plant-report-form.module.css';

type SkidFill = 'empty' | 'loading' | 'loaded' | 'on_hold';
type SkidBay = 'washing_bay' | 'loading_bay' | 'parking_bay';
type PlantStatusSection =
  'skids' | 'trucks' | 'pressures' | 'equipment' | 'compressors' | 'preview';
type CompressorRow = { id: number; name: string; status: 'on' | 'off'; note: string };
type ExtraFieldRow = { id: number; name: string; value: string };
type TruckStatusDraft = {
  isStandby: boolean;
  isOnMaintenance: boolean;
  maintenanceNote: string;
  note: string;
};

export default function PlantReportForm() {
  const [activeSection, setActiveSection] = useState<PlantStatusSection>('skids');
  const [dashboard, setDashboard] = useState<PlantDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState('');
  const [fillState, setFillState] = useState<SkidFill | ''>('');
  const [bay, setBay] = useState<SkidBay | ''>('');
  const [note, setNote] = useState('');
  const [isOnMaintenance, setIsOnMaintenance] = useState(false);
  const [maintenanceNote, setMaintenanceNote] = useState('');
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
  const nextRowId = useRef(0);

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
    setError(null);
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
      setError(loadError instanceof Error ? loadError.message : 'Unable to load plant skids.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [loadStatus]);

  useEffect(() => {
    setCompressors((current) =>
      current.length
        ? current
        : Array.from({ length: 10 }, (_, index) => {
            const name = `COMP ${index + 1}`;
            const saved = metrics.compressors?.[name];
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
        : Object.entries(metrics.extraFields ?? {}).map(([name, value]) => ({
            id: nextRowId.current++,
            name,
            value: String(value),
          }))
    );
  }, [metrics.compressors, metrics.extraFields]);

  useEffect(() => {
    function closeSearch(event: MouseEvent | TouchEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', closeSearch);
    document.addEventListener('touchstart', closeSearch);
    return () => {
      document.removeEventListener('mousedown', closeSearch);
      document.removeEventListener('touchstart', closeSearch);
    };
  }, []);

  const filteredSkids = useMemo(() => {
    if (!dashboard) return [];
    const filtersActive =
      filterFill !== '' ||
      filterOwner !== '' ||
      filterBay !== '' ||
      filterMaintenance !== '' ||
      filterNew !== '';
    if (!search.trim() && !filtersActive) return [];
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

  function clearRow() {
    setSelectedId('');
    setSearch('');
    setFillState('');
    setBay('');
    setNote('');
    setIsOnMaintenance(false);
    setMaintenanceNote('');
  }

  function selectSkid(skid: PlantYardSkid) {
    setSelectedId(skid.id);
    setSearch(skid.skidNum);
    const nextFillState = skid.fillState ?? 'empty';
    setFillState(nextFillState);
    setBay(nextFillState === 'loading' ? 'loading_bay' : (skid.bay ?? 'parking_bay'));
    setNote(skid.note ?? '');
    setIsOnMaintenance(skid.isOnMaintenance ?? false);
    setMaintenanceNote(skid.maintenanceNote ?? '');
  }

  async function recordRow(event?: FormEvent) {
    event?.preventDefault();
    if (!selectedId) {
      const exact = filteredSkids.find(
        (skid) => skid.skidNum.toLowerCase() === search.trim().toLowerCase()
      );
      const match = exact ?? filteredSkids[0];
      if (!match) return;
      setSaving(true);
      setError(null);
      try {
        await updateSkidStatus(match.id, {
          fillState: match.fillState ?? 'empty',
          bay: match.bay ?? 'parking_bay',
          isOnMaintenance: match.isOnMaintenance ?? false,
          maintenanceNote: match.maintenanceNote,
          note: match.note,
        });
        await loadStatus();
        clearRow();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unable to record skid status.');
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!fillState || !bay) {
      setError('Complete fill state and bay.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateSkidStatus(selectedId, {
        fillState,
        bay,
        isOnMaintenance,
        maintenanceNote: maintenanceNote.trim() || null,
        note: note.trim() || null,
      });
      await loadStatus();
      clearRow();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to record skid status.');
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
    if (!officersOnDuty.trim()) {
      setError('Enter the logistics officer(s) on duty.');
      setActiveSection('pressures');
      return;
    }
    setSaving(true);
    setError(null);
    setCopied(false);
    try {
      const result = await submitPlantReport({
        officersOnDuty: officersOnDuty.trim(),
        metrics: buildMetrics(),
        skidUpdates: [],
      });
      setFormattedMessage(result.formattedMessage);
      setActiveSection('preview');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to generate plant status.');
    } finally {
      setSaving(false);
    }
  }

  async function copyStatus() {
    if (!formattedMessage) return;
    await navigator.clipboard.writeText(formattedMessage);
    setCopied(true);
  }

  return (
    <div className={styles.shell}>
      <OperationsSidebar active="plant-report" />
      <main className={styles.main}>
        <header className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>Plant operations</p>
            <h1 className={styles.title}>Plant status</h1>
            <p className={styles.subtitle}>
              Search or filter plant skids, update them, then record.
            </p>
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

        {error ? (
          <div className={styles.error} role="alert">
            {error}
          </div>
        ) : null}

        <div className={styles.statusTabs} role="tablist" aria-label="Plant status section">
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
            Pressures & officer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'equipment'}
            className={`${styles.statusTab} ${activeSection === 'equipment' ? styles.statusTabActive : ''}`}
            onClick={() => setActiveSection('equipment')}
          >
            Gear & equipment
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

        {activeSection === 'trucks' ? (
          <section className={styles.truckStatus}>
            <header className={styles.skidListHeader}>
              <strong>Truck status</strong>
              <span>Gastech vehicles</span>
            </header>
            <div className={styles.truckGrid}>
              {(dashboard?.plantTrucks ?? []).map((truck) => {
                const status = truckStatuses[truck.id] ?? {
                  isStandby: truck.isStandby ?? false,
                  isOnMaintenance: truck.isOnMaintenance ?? false,
                  maintenanceNote: truck.maintenanceNote ?? '',
                  note: truck.note ?? '',
                };
                return (
                  <article className={styles.truckCard} key={truck.id}>
                    <div>
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
                        value={status.maintenanceNote}
                        onChange={(event) =>
                          setTruckStatuses((current) => ({
                            ...current,
                            [truck.id]: { ...status, maintenanceNote: event.target.value },
                          }))
                        }
                        placeholder="Why is it in maintenance?"
                      />
                    ) : null}
                    <button
                      type="button"
                      className={styles.recordButton}
                      onClick={async () => {
                        await updateTruckPlantStatus(truck.id, {
                          isStandby: status.isStandby,
                          isOnMaintenance: status.isOnMaintenance,
                          maintenanceNote: status.maintenanceNote.trim() || null,
                          note: status.note.trim() || null,
                        });
                        await loadStatus();
                      }}
                    >
                      <Save size={13} /> Save
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ) : activeSection === 'skids' ? (
          <>
            <form className={styles.skidEntry} onSubmit={recordRow}>
              <div className={styles.skidSearch} ref={searchRef}>
                <label htmlFor="skid-search">Search</label>
                <input
                  id="skid-search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setSelectedId('');
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Skid number..."
                />
                {searchOpen && search.trim() ? (
                  <div className={styles.searchSuggestions}>
                    {filteredSkids.slice(0, 6).map((skid) => (
                      <button
                        type="button"
                        key={skid.id}
                        onClick={() => {
                          selectSkid(skid);
                          setSearchOpen(false);
                        }}
                      >
                        <strong>{skid.skidNum}</strong>
                        <span>
                          {skid.owner} · {skid.fillState?.replace('_', ' ') ?? 'No fill state'}
                        </span>
                      </button>
                    ))}
                    {!filteredSkids.length ? (
                      <div className={styles.noSearchMatches}>No matching skids</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className={styles.skidField}>
                <label htmlFor="skid-fill">Fill state</label>
                <select
                  id="skid-fill"
                  value={fillState}
                  onChange={(event) => {
                    const nextFillState = event.target.value as SkidFill;
                    setFillState(nextFillState);
                    if (nextFillState === 'loading') setBay('loading_bay');
                  }}
                >
                  <option value="" disabled>
                    Fill state
                  </option>
                  <option value="empty">Empty</option>
                  <option value="loading">Loading</option>
                  <option value="loaded">Loaded</option>
                  <option value="on_hold">On hold</option>
                </select>
              </div>
              <div className={styles.skidField}>
                <label htmlFor="skid-bay">Bay</label>
                <select
                  id="skid-bay"
                  value={bay}
                  onChange={(event) => setBay(event.target.value as SkidBay)}
                  disabled={fillState === 'loading'}
                >
                  <option value="" disabled>
                    Bay
                  </option>
                  <option value="washing_bay">Washing</option>
                  <option value="loading_bay">Loading</option>
                  <option value="parking_bay">Parking</option>
                </select>
              </div>
              <div className={styles.skidNote}>
                <label htmlFor="skid-note">Note</label>
                <input
                  id="skid-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Note..."
                />
              </div>
              <div className={styles.skidMaintenance}>
                <label>Maintenance</label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isOnMaintenance}
                  className={`${styles.toggle} ${isOnMaintenance ? styles.toggleOn : ''}`}
                  onClick={() => setIsOnMaintenance((value) => !value)}
                >
                  <span />
                </button>
                {isOnMaintenance ? (
                  <input
                    value={maintenanceNote}
                    onChange={(event) => setMaintenanceNote(event.target.value)}
                    placeholder="Why is it in maintenance?"
                  />
                ) : null}
              </div>
              <button
                type="button"
                className={styles.filterButton}
                onClick={() => setFiltersOpen((open) => !open)}
                aria-label="Filter skids"
                aria-expanded={filtersOpen}
              >
                <Filter size={15} />
              </button>
              <button type="submit" className={styles.recordButton} disabled={saving || loading}>
                <Save size={14} /> {saving ? 'Saving...' : 'Record'}
              </button>
            </form>

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
                  <option value="">Maintenance: all</option>
                  <option value="no">Maintenance: no</option>
                  <option value="yes">Maintenance: yes</option>
                </select>
                <select
                  value={filterNew === '' ? '' : filterNew ? 'yes' : 'no'}
                  onChange={(event) =>
                    setFilterNew(event.target.value === '' ? '' : event.target.value === 'yes')
                  }
                >
                  <option value="">New: all</option>
                  <option value="no">New: no</option>
                  <option value="yes">New: yes</option>
                </select>
                <button type="button" className={styles.buttonSecondary} onClick={clearFilters}>
                  Clear
                </button>
              </div>
            ) : null}

            <section className={styles.skidListPanel}>
              <div className={styles.skidListHeader}>
                <strong>Plant skids</strong>
                <span>{filteredSkids.length} found</span>
              </div>
              <div className={styles.skidList}>
                {loading ? (
                  <div className={styles.emptyState}>Loading skids...</div>
                ) : filteredSkids.length ? (
                  filteredSkids.map((skid) => (
                    <button
                      type="button"
                      className={`${styles.skidListRow} ${selectedId === skid.id ? styles.skidListRowActive : ''}`}
                      key={skid.id}
                      onClick={() => selectSkid(skid)}
                    >
                      <strong>{skid.skidNum}</strong>
                      <span>{skid.fillState?.replace('_', ' ') ?? 'Not set'}</span>
                      <span>{skid.owner}</span>
                      <span>{skid.bay?.replace('_bay', '') ?? 'Not set'}</span>
                      <span>{skid.isOnMaintenance ? 'Maintenance' : 'Operational'}</span>
                      <span>{skid.isNew ? 'New' : 'Existing'}</span>
                      <span>{skid.note || '—'}</span>
                    </button>
                  ))
                ) : (
                  <div className={styles.emptyState}>No matching plant skids.</div>
                )}
              </div>
            </section>
          </>
        ) : activeSection === 'pressures' ? (
          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Pressures & officer</h2>
                <p className={styles.panelHint}>Enter the current readings and officer name.</p>
              </div>
            </header>
            <div className={styles.panelBody}>
              <div className={styles.fieldGrid}>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label htmlFor="officers">
                    Logistics officer(s) on duty <span className={styles.required}>*</span>
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
                  <label htmlFor="loading-pressure">Skids loading at (bar)</label>
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
                <h2 className={styles.panelTitle}>Gear & equipment</h2>
                <p className={styles.panelHint}>Landing gearboxes, new chassis and compressors.</p>
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
                  <h3 className={styles.subsectionTitle}>Extra fields</h3>
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
                      placeholder="Field name"
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
                      placeholder="Value"
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
                      placeholder="Optional note"
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
                <h2 className={styles.panelTitle}>WhatsApp preview</h2>
                <p className={styles.panelHint}>Review, copy, and paste manually.</p>
              </div>
              <button
                type="button"
                className={styles.button}
                onClick={() => void generateStatus()}
                disabled={saving}
              >
                {saving ? <RefreshCw size={14} /> : <Save size={14} />}
                {saving ? 'Generating...' : 'Generate status'}
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
                  >
                    <Copy size={13} />
                    {copied ? 'Copied' : 'Copy text'}
                  </button>
                </>
              ) : (
                <div className={styles.emptyState}>
                  Generate the status to preview the WhatsApp message.
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
