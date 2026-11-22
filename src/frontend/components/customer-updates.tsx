'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Droplets,
  Gauge,
  RefreshCw,
  Waves,
} from 'lucide-react';
import { getCustomerForecast, listCustomerUpdates } from '@/frontend/actions/customer-updates';
import type { CustomerForecast, CustomerUpdateMessage } from '@/frontend/types/customer-update';
import type { PaginationMeta } from '@/frontend/types/dispatch-review';
import OperationsSidebar from './operations-sidebar';
import styles from './customer-updates.module.css';

const PAGE_SIZE = 25;
const REFRESH_INTERVAL_MS = 30_000;

function formatDate(value: string | null, includeTime = false) {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' as const } : {}),
  }).format(date);
}

function listValue(value: string | string[] | null) {
  if (value === null) return 'Not reported';
  return Array.isArray(value) ? value.join(', ') : value;
}

function updateStatus(status: CustomerUpdateMessage['processingStatus'], isProcessed: boolean) {
  if (!isProcessed || status === null) return 'awaiting processing';
  return status.replaceAll('_', ' ');
}

function statusClass(status: CustomerUpdateMessage['processingStatus'], isProcessed: boolean) {
  if (!isProcessed || status === null) return '';
  if (status === 'ok') return styles.badgeOk;
  if (status === 'needs_review') return styles.badgeReview;
  return styles.badgeFailed;
}

function ForecastPanel({
  forecast,
  loading,
  error,
}: {
  forecast: CustomerForecast | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return <div className={styles.empty}><RefreshCw size={17} className="animate-spin" /> Loading skid forecast…</div>;
  }
  if (error) return <div className={styles.error} role="alert">{error}</div>;
  if (!forecast) {
    return (
      <div className={styles.empty}>
        <Gauge size={19} />
        <strong>No forecast available yet</strong>
        <span>The customer update may still be processing, or there may not be a processed update for this customer.</span>
      </div>
    );
  }

  return (
    <>
      <p className={styles.detailMeta}>
        Forecast based on latest processed update received {formatDate(forecast.receivedAt, true)}
        {forecast.reportedAt ? ` · Reported ${formatDate(forecast.reportedAt)}` : ''}
      </p>
      {forecast.warnings.length ? (
        <div className={styles.warningBox}>
          <p className={styles.warningTitle}><AlertTriangle size={13} /> Update needs attention</p>
          <ul className={styles.warningList}>
            {forecast.warnings.map((warning) => <li key={warning}>{warning.replaceAll('_', ' ')}</li>)}
          </ul>
        </div>
      ) : null}
      {forecast.prmsForecasts.length ? (
        <div className={styles.forecastGrid}>
          {forecast.prmsForecasts.map((prms) => {
            const cardClass = prms.status === 'needs_review'
              ? styles.forecastCardReview
              : prms.status === 'unavailable'
                ? styles.forecastCardUnavailable
                : '';
            return (
              <article className={`${styles.forecastCard} ${cardClass}`} key={prms.prmsId}>
                <div className={styles.forecastTop}>
                  <span>PRMS {prms.prmsId}</span>
                  <span className={`${styles.badge} ${prms.status === 'estimated' ? styles.badgeOk : prms.status === 'needs_review' ? styles.badgeReview : styles.badgeFailed}`}>
                    {prms.status.replaceAll('_', ' ')}
                  </span>
                </div>
                <p className={styles.runtime}>{prms.estimatedTimeRemaining ?? 'Unavailable'}</p>
                <p className={styles.runtimeCaption}>
                  {prms.estimatedHoursRemaining === null
                    ? 'Insufficient data for runtime estimate'
                    : `${prms.estimatedHoursRemaining.toFixed(2)} hours estimated`}
                </p>
                <div className={styles.forecastNumbers}>
                  <span>Pressure: {prms.pressureBar === null ? '—' : `${prms.pressureBar} bar`}</span>
                  <span>Flow: {prms.flowRateScmPerHour === null ? '—' : `${prms.flowRateScmPerHour} scm/h`}</span>
                </div>
                <p className={styles.forecastNumbers}>
                  Skid{prms.skidNumbers.length === 1 ? '' : 's'}: {prms.skidNumbers.length ? prms.skidNumbers.join(', ') : 'Not reported'}
                </p>
                {prms.warnings.length ? (
                  <p className={styles.forecastWarnings}>{prms.warnings.map((warning) => warning.replaceAll('_', ' ')).join(' · ')}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}><strong>No PRMS readings in the latest processed update.</strong></div>
      )}
      <p className={styles.helper}>
        Runtime is estimated from reported pressure and flow rate. It is an operational estimate, not a confirmed depletion time; review flagged updates before acting.
      </p>
    </>
  );
}

export default function CustomerUpdates() {
  const [updates, setUpdates] = useState<CustomerUpdateMessage[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [forecast, setForecast] = useState<CustomerForecast | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [updatesError, setUpdatesError] = useState<string | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const selectedIdRef = useRef<string | null>(null);
  const forecastRequestRef = useRef(0);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const result = await listCustomerUpdates({ page, limit: PAGE_SIZE });
      setUpdates(result.updates);
      setPagination(result.pagination);
      setUpdatesError(null);
      const selected = result.updates.find((item) => item.id === selectedIdRef.current)
        ?? result.updates[0]
        ?? null;
      if (selected?.id !== selectedIdRef.current) {
        selectedIdRef.current = selected?.id ?? null;
        setSelectedId(selected?.id ?? null);
      }
    } catch (error) {
      setUpdatesError(error instanceof Error ? error.message : 'Unable to load customer updates.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(true), 0);
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const selected = updates.find((update) => update.id === selectedId) ?? null;
  const selectedCustomerId = selected?.customerId ?? null;

  useEffect(() => {
    const requestId = ++forecastRequestRef.current;
    if (!selectedCustomerId) {
      const clearTimer = window.setTimeout(() => {
        setForecast(null);
        setForecastError(null);
        setForecastLoading(false);
      }, 0);
      return () => window.clearTimeout(clearTimer);
    }

    const initialTimer = window.setTimeout(() => {
      setForecast(null);
      setForecastLoading(true);
      setForecastError(null);
      void getCustomerForecast(selectedCustomerId)
        .then((result) => {
          if (forecastRequestRef.current === requestId) setForecast(result);
        })
        .catch((error: unknown) => {
          if (forecastRequestRef.current === requestId) {
            setForecastError(error instanceof Error ? error.message : 'Unable to load customer forecast.');
          }
        })
        .finally(() => {
          if (forecastRequestRef.current === requestId) setForecastLoading(false);
        });
    }, 0);

    return () => window.clearTimeout(initialTimer);
  }, [selectedCustomerId]);

  const needsReviewCount = updates.filter((item) => item.processingStatus === 'needs_review').length;
  const failedCount = updates.filter((item) => item.processingStatus === 'failed').length;
  const selectedData = selected?.parsedData ?? null;
  const selectedSkidsInUse = selectedData?.PRMS.flatMap((prms) => {
    if (prms.skidinuse === null) return [];
    return Array.isArray(prms.skidinuse) ? prms.skidinuse : [prms.skidinuse];
  }) ?? [];

  function selectUpdate(update: CustomerUpdateMessage) {
    selectedIdRef.current = update.id;
    setSelectedId(update.id);
  }

  return (
    <div className={styles.shell}>
      <OperationsSidebar active="updates" />
      <main className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.breadcrumb}><span>Operations</span><span>/</span><strong>Customer updates</strong></div>
          <div className={styles.refreshInfo}><span className={styles.liveDot} /> Auto-refreshes every 30 seconds</div>
        </div>

        <header className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>Customer monitoring</p>
            <h1 className={styles.title}>Customer updates & skid forecast</h1>
            <p className={styles.subtitle}>Review reported PRMS readings and estimated runtime for the latest customer update.</p>
          </div>
          <button className={styles.refreshButton} type="button" onClick={() => void refresh(true)} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} /> Refresh
          </button>
        </header>

        {updatesError ? <div className={styles.failureBox} role="alert">{updatesError}</div> : null}

        <section className={styles.stats} aria-label="Customer update summary">
          <div className={styles.statCard}>
            <div className={styles.statIcon}><Waves size={16} /></div>
            <div><p className={styles.statLabel}>Total updates</p><p className={styles.statValue}>{pagination?.total ?? '—'}</p></div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconAmber}`}><AlertTriangle size={16} /></div>
            <div><p className={styles.statLabel}>Need review on this page</p><p className={styles.statValue}>{needsReviewCount}</p></div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconRed}`}><AlertTriangle size={16} /></div>
            <div><p className={styles.statLabel}>Failed parsing on this page</p><p className={styles.statValue}>{failedCount}</p></div>
          </div>
        </section>

        <section className={styles.content} aria-label="Customer update inbox">
          <div className={styles.inbox}>
            <header className={styles.inboxHeader}>
              <div>
                <h2 className={styles.inboxTitle}>Incoming updates</h2>
                <p className={styles.inboxSub}>{pagination?.total ?? 0} customer messages</p>
              </div>
              <Waves size={16} />
            </header>

            <div className={styles.list}>
              {loading ? (
                <div className={styles.empty}><RefreshCw size={17} className="animate-spin" /> Loading customer updates…</div>
              ) : updates.length === 0 ? (
                <div className={styles.empty}>
                  <CheckCircle2 size={19} />
                  <strong>No customer updates yet</strong>
                  <span>Incoming customer readings will appear here after they are received.</span>
                </div>
              ) : updates.map((update) => (
                <button
                  type="button"
                  key={update.id}
                  className={`${styles.updateButton} ${selectedId === update.id ? styles.updateButtonSelected : ''}`}
                  onClick={() => selectUpdate(update)}
                  aria-pressed={selectedId === update.id}
                >
                  <span className={styles.updateTop}>
                    <span className={styles.customerName}>{update.customerName}</span>
                    <span className={styles.date}>{formatDate(update.createdAt, true)}</span>
                  </span>
                  <span className={styles.preview}>{update.text}</span>
                  <span className={styles.updateBottom}>
                    <span className={`${styles.badge} ${statusClass(update.processingStatus, update.isProcessed)}`}>
                      {updateStatus(update.processingStatus, update.isProcessed)}
                    </span>
                    {update.parsedData?.PRMS.length ? <span className={styles.date}>{update.parsedData.PRMS.length} PRMS</span> : null}
                  </span>
                </button>
              ))}
            </div>

            <footer className={styles.footer}>
              <span>{pagination?.total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, pagination.total)} of ${pagination.total}` : 'No results'}</span>
              <div className={styles.footerActions}>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="Previous page"
                  disabled={!pagination?.hasPrevious || loading}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                ><ChevronLeft size={15} /></button>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="Next page"
                  disabled={!pagination?.hasNext || loading}
                  onClick={() => setPage((value) => value + 1)}
                ><ChevronRight size={15} /></button>
              </div>
            </footer>
          </div>

          <div className={styles.detail}>
            {!selected ? (
              <div className={styles.empty}>
                <div className={styles.statIcon}><Droplets size={18} /></div>
                <strong>Select a customer update</strong>
                <span>Parsed pressure, flow, skid details, and runtime estimate will appear here.</span>
              </div>
            ) : (
              <>
                <header className={styles.detailHeader}>
                  <div>
                    <p className={styles.eyebrow}>Customer update</p>
                    <h2 className={styles.detailTitle}>{selected.customerName}</h2>
                    <p className={styles.detailMeta}>Received {formatDate(selected.createdAt, true)}</p>
                  </div>
                  <span className={`${styles.badge} ${statusClass(selected.processingStatus, selected.isProcessed)}`}>
                    {updateStatus(selected.processingStatus, selected.isProcessed)}
                  </span>
                </header>

                {selected.processingStatus === 'failed' ? (
                  <div className={styles.failureBox}>
                    <p className={styles.warningTitle}><AlertTriangle size={13} /> Update parsing failed</p>
                    {selected.warnings?.map((warning) => warning.replaceAll('_', ' ')).join(' · ') || 'No parser details are available.'}
                  </div>
                ) : null}
                {selected.warnings?.length && selected.processingStatus !== 'failed' ? (
                  <div className={styles.warningBox}>
                    <p className={styles.warningTitle}><AlertTriangle size={13} /> Review the reported values</p>
                    <ul className={styles.warningList}>
                      {selected.warnings.map((warning) => <li key={warning}>{warning.replaceAll('_', ' ')}</li>)}
                    </ul>
                  </div>
                ) : null}
                {!selected.isProcessed ? (
                  <div className={styles.warningBox}>
                    <p className={styles.warningTitle}><Clock3 size={13} /> Waiting for update processing</p>
                    <span>Parsed values and forecast will appear after the message processing task completes.</span>
                  </div>
                ) : null}

                {selectedData ? (
                  <>
                    <h3 className={styles.sectionTitle}><Gauge size={14} /> Reported readings</h3>
                    <div className={styles.dataGrid}>
                      {selectedData.PRMS.map((prms) => (
                        <article className={styles.dataTile} key={prms.id}>
                          <span className={styles.dataLabel}>PRMS {prms.id} pressure</span>
                          <strong className={styles.dataValue}>{prms.pressure === null ? '—' : `${prms.pressure} bar`}</strong>
                        </article>
                      ))}
                      {selectedData.PRMS.map((prms) => (
                        <article className={styles.dataTile} key={`flow-${prms.id}`}>
                          <span className={styles.dataLabel}>PRMS {prms.id} flow rate</span>
                          <strong className={styles.dataValue}>{prms.flowrate === null ? '—' : `${prms.flowrate} scm/h`}</strong>
                        </article>
                      ))}
                      {selectedData.outletpressure !== null ? (
                        <article className={styles.dataTile}>
                          <span className={styles.dataLabel}>Outlet pressure</span>
                          <strong className={styles.dataValue}>{selectedData.outletpressure} bar</strong>
                        </article>
                      ) : null}
                      {selectedData.availabletrucks !== null ? (
                        <article className={styles.dataTile}>
                          <span className={styles.dataLabel}>Available trucks</span>
                          <strong className={styles.dataValue}>
                            {typeof selectedData.availabletrucks === 'number'
                              ? selectedData.availabletrucks
                              : selectedData.availabletrucks.join(', ')}
                          </strong>
                        </article>
                      ) : null}
                    </div>

                    <h3 className={styles.sectionTitle}><Gauge size={14} /> Latest skid runtime forecast</h3>
                    <ForecastPanel forecast={forecast} loading={forecastLoading} error={forecastError} />

                    <div className={styles.reportedSkids}>
                      <div className={styles.reportedSkidGroup}>
                        <label>Skid in use</label>
                        <strong>{listValue(selectedSkidsInUse.length ? selectedSkidsInUse : null)}</strong>
                      </div>
                      <div className={styles.reportedSkidGroup}>
                        <label>Standby skid</label>
                        <strong>{listValue(selectedData.standbyskid)}</strong>
                      </div>
                      <div className={styles.reportedSkidGroup}>
                        <label>Empty skid</label>
                        <strong>{listValue(selectedData.emptyskid)}</strong>
                      </div>
                    </div>
                  </>
                ) : null}

                <details>
                  <summary className={styles.sectionTitle}>Original customer message</summary>
                  <pre className={styles.source}>{selected.text}</pre>
                </details>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
