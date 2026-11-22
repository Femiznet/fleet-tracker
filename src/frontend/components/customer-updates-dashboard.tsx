'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Droplets,
  Gauge,
  RefreshCw,
  Search,
  Users,
  Waves,
} from 'lucide-react';
import { useToast } from './toast-provider';
import {
  getCustomerAnalytics,
  getCustomerUpdatesAnalytics,
  listCustomerUpdateHistory,
} from '@/frontend/actions/customer-updates';
import type {
  CustomerFlowRanking,
  CustomerSummary,
  CustomerUpdateAnalytics,
  CustomerUpdateHistoryItem,
  CustomerUpdatePeriod,
  CustomerUpdateStatusFilter,
  CustomerUpdateTrendPoint,
} from '@/frontend/types/customer-update';
import type { PaginationMeta } from '@/frontend/types/dispatch-review';
import OperationsSidebar from './operations-sidebar';
import styles from './customer-analytics.module.css';

const PAGE_SIZE = 15;
const REFRESH_INTERVAL_MS = 30_000;
const CUSTOMER_PREVIEW_LIMIT = 5;
type CustomerView = 'overview' | 'customer' | 'history';
type CustomerFilter = 'all' | 'needs-review';

function needsReview(customer: CustomerSummary) {
  const latest = customer.latestUpdate;
  return Boolean(latest && (!latest.isProcessed || latest.processingStatus !== 'ok'));
}

function formatDate(value: string | null, includeTime = false) {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' as const } : {}),
  }).format(date);
}

function statusLabel(status: string | null, processed = true) {
  if (!status) return processed ? 'Status unavailable' : 'Pending';
  return status.replaceAll('_', ' ');
}

function statusClass(status: string | null) {
  if (status === 'ok') return styles.badgeOk;
  if (status === 'needs_review') return styles.badgeReview;
  if (status === 'failed') return styles.badgeFailed;
  return styles.badgePending;
}

function formatRuntime(hours: number | null) {
  if (hours === null) return 'Unavailable';
  const minutes = Math.max(0, Math.round(hours * 60));
  const wholeHours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${wholeHours}h ${remainingMinutes}m`;
}

function listValue(value: string | string[] | null) {
  if (value === null) return 'Not reported';
  return Array.isArray(value) ? value.join(', ') : value;
}

function latestUpdateTime(customer: CustomerSummary) {
  const timestamp = customer.latestUpdate?.createdAt;
  return timestamp ? new Date(timestamp).getTime() : 0;
}

function TrendChart({
  title,
  description,
  points,
  unit,
  color,
}: {
  title: string;
  description: string;
  points: CustomerUpdateTrendPoint[];
  unit: string;
  color: string;
}) {
  const width = 720;
  const height = 220;
  const left = 46;
  const right = 18;
  const top = 18;
  const bottom = 35;
  const values = points.map((point) => point.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const spread = max - min || Math.max(Math.abs(max) * 0.1, 1);
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const coordinates = points.map((point, index) => ({
    point,
    x: left + (points.length <= 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth),
    y: top + ((max + spread * 0.08 - point.value) / (spread * 1.16)) * chartHeight,
  }));
  const labelTime = (value: string) =>
    new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric' }).format(
      new Date(value)
    );

  return (
    <section className={styles.chartCard}>
      <header className={styles.cardHeader}>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className={styles.chartUnit}>{unit}</span>
      </header>
      {points.length ? (
        <div className={styles.chartFrame}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${title} over time`}
            preserveAspectRatio="none"
          >
            {[0, 0.5, 1].map((fraction) => {
              const y = top + fraction * chartHeight;
              const value = max + spread * 0.08 - fraction * spread * 1.16;
              return (
                <g key={fraction}>
                  <line
                    x1={left}
                    y1={y}
                    x2={width - right}
                    y2={y}
                    className={styles.chartGridLine}
                  />
                  <text x={left - 7} y={y + 3} textAnchor="end" className={styles.chartAxisLabel}>
                    {value.toFixed(value >= 10 ? 0 : 1)}
                  </text>
                </g>
              );
            })}
            {coordinates.length > 1 ? (
              <polyline
                points={coordinates.map(({ x, y }) => `${x},${y}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {coordinates.map(({ point, x, y }, index) => (
              <circle
                key={`${point.timestamp}-${point.customerId}-${index}`}
                cx={x}
                cy={y}
                r="4"
                fill={
                  point.status === 'failed'
                    ? '#b3433b'
                    : point.status === 'needs_review'
                      ? '#d39328'
                      : color
                }
                stroke="#fff"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              >
                <title>
                  {`${point.customerName} · ${labelTime(point.timestamp)} · ${point.value.toFixed(2)} ${unit} · ${statusLabel(point.status)}`}
                </title>
              </circle>
            ))}
            <text x={left} y={height - 8} className={styles.chartAxisLabel}>
              {labelTime(points[0].timestamp)}
            </text>
            {points.length > 1 ? (
              <text
                x={width - right}
                y={height - 8}
                textAnchor="end"
                className={styles.chartAxisLabel}
              >
                {labelTime(points[points.length - 1].timestamp)}
              </text>
            ) : null}
          </svg>
        </div>
      ) : (
        <div className={styles.chartEmpty}>No readings in this period.</div>
      )}
    </section>
  );
}

function CustomerSelector({
  customers,
  flowRanking,
  selectedCustomerId,
  search,
  customerFilter,
  onSearch,
  onCustomerFilterChange,
  onSelect,
}: {
  customers: CustomerSummary[];
  flowRanking: CustomerFlowRanking[];
  selectedCustomerId: string | null;
  search: string;
  customerFilter: CustomerFilter;
  onSearch: (value: string) => void;
  onCustomerFilterChange: (value: CustomerFilter) => void;
  onSelect: (id: string) => void;
}) {
  const [showAllCustomers, setShowAllCustomers] = useState(false);
  const flowRankByCustomer = new Map(
    flowRanking.map((customer, index) => [customer.customerId, index])
  );
  const orderedCustomers = [...customers].sort((a, b) => {
    const rankA = flowRankByCustomer.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const rankB = flowRankByCustomer.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return rankA - rankB || a.name.localeCompare(b.name);
  });
  const filteredCustomers = orderedCustomers.filter(
    (customer) =>
      (customerFilter === 'all' || needsReview(customer)) &&
      `${customer.name} ${customer.location ?? ''}`
        .toLowerCase()
        .includes(search.trim().toLowerCase())
  );
  const isSearching = Boolean(search.trim());
  const previewCustomers = showAllCustomers
    ? filteredCustomers
    : filteredCustomers.slice(0, CUSTOMER_PREVIEW_LIMIT);
  const selectedCustomer = filteredCustomers.find((customer) => customer.id === selectedCustomerId);
  const visibleCustomers =
    selectedCustomer && !previewCustomers.some((customer) => customer.id === selectedCustomer.id)
      ? [...previewCustomers, selectedCustomer]
      : previewCustomers;

  return (
    <aside
      className={styles.customerSelector}
      id={customerFilter === 'needs-review' ? 'customer-updates-review' : undefined}
    >
      <header className={styles.selectorHeader}>
        <div>
          <h2>Customers</h2>
          <p>{customers.length} customers</p>
        </div>
        <Users size={17} />
      </header>
      <label className={styles.customerStatusFilter}>
        <span>Show</span>
        <select
          value={customerFilter}
          onChange={(event) =>
            onCustomerFilterChange(event.target.value === 'needs-review' ? 'needs-review' : 'all')
          }
          aria-label="Filter customers by update status"
        >
          <option value="all">All customers</option>
          <option value="needs-review">Needs review</option>
        </select>
      </label>
      <label className={styles.customerSearch}>
        <Search size={14} />
        <input
          value={search}
          onChange={(event) => {
            onSearch(event.target.value);
            setShowAllCustomers(false);
          }}
          placeholder="Search customer name or location"
          aria-label="Search customers"
        />
      </label>
      <div
        className={`${styles.customerList} ${showAllCustomers ? styles.customerListExpanded : ''}`}
      >
        {filteredCustomers.length ? (
          visibleCustomers.map((customer) => {
            const latest = customer.latestUpdate;
            return (
              <button
                type="button"
                key={customer.id}
                className={`${styles.customerButton} ${selectedCustomerId === customer.id ? styles.customerButtonSelected : ''}`}
                onClick={() => onSelect(customer.id)}
              >
                <span className={styles.customerButtonTop}>
                  <strong>{customer.name}</strong>
                  <span
                    className={`${styles.badge} ${statusClass(latest?.processingStatus ?? null)}`}
                  >
                    {latest
                      ? statusLabel(latest.processingStatus, latest.isProcessed)
                      : 'No updates'}
                  </span>
                </span>
                <span className={styles.customerButtonMeta}>
                  {latest ? formatDate(latest.createdAt, true) : 'No received updates'}
                </span>
                <span className={styles.customerButtonStats}>
                  <span>
                    Runtime <strong>{formatRuntime(customer.estimatedRuntimeHours)}</strong>
                  </span>
                </span>
              </button>
            );
          })
        ) : (
          <div className={styles.selectorEmpty}>
            {customerFilter === 'needs-review'
              ? 'No customers currently need review.'
              : search
                ? 'No customers match your search.'
                : 'No customers available.'}
          </div>
        )}
      </div>
      {filteredCustomers.length > CUSTOMER_PREVIEW_LIMIT ? (
        <button
          type="button"
          className={styles.viewAllCustomers}
          aria-expanded={showAllCustomers}
          onClick={() => setShowAllCustomers((current) => !current)}
        >
          {showAllCustomers
            ? 'Show fewer customers'
            : isSearching
              ? `View all ${filteredCustomers.length} results`
              : `View all ${filteredCustomers.length} customers`}
        </button>
      ) : null}
    </aside>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
  variant,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  variant?: 'warning';
}) {
  return (
    <article
      className={`${styles.summaryCard} ${variant === 'warning' ? styles.summaryWarning : ''}`}
    >
      <span className={styles.summaryIcon}>{icon}</span>
      <span className={styles.summaryLabel}>{label}</span>
      <strong className={styles.summaryValue}>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function OverviewPanel({
  analytics,
  onSelectCustomer,
  onSelectUpdate,
}: {
  analytics: CustomerUpdateAnalytics;
  onSelectCustomer: (customerId: string) => void;
  onSelectUpdate: (update: CustomerUpdateHistoryItem) => void;
}) {
  const { summary } = analytics;
  const maxFlow = Math.max(...analytics.flowRanking.map((item) => item.flowRateScmPerHour), 1);

  return (
    <>
      <section className={styles.summaryGrid} aria-label="Customer analytics summary">
        <SummaryCard
          label="Active customers"
          value={summary.activeCustomerCount.toLocaleString()}
          detail="In the customer directory"
          icon={<Users size={17} />}
        />
        <SummaryCard
          label="Updates received"
          value={summary.totalUpdates.toLocaleString()}
          detail={`During the last ${analytics.period}`}
          icon={<Waves size={17} />}
        />
        <SummaryCard
          label="Customers needing review"
          value={summary.customersNeedingReview.toLocaleString()}
          detail="Latest update flagged or failed"
          icon={<AlertTriangle size={17} />}
          variant={summary.customersNeedingReview ? 'warning' : undefined}
        />
      </section>

      <section className={styles.insightGrid} aria-label="Customer runtime highlights">
        <button
          type="button"
          className={styles.insightCard}
          disabled={!summary.shortestRuntimeCustomer}
          onClick={() =>
            summary.shortestRuntimeCustomer &&
            onSelectCustomer(summary.shortestRuntimeCustomer.customerId)
          }
        >
          <span className={`${styles.insightIcon} ${styles.insightIconAmber}`}>
            <ArrowDownRight size={16} />
          </span>
          <span>
            <small>Shortest estimated runtime</small>
            <strong>{summary.shortestRuntimeCustomer?.customerName ?? 'No runtime data'}</strong>
            <small>
              {summary.shortestRuntimeCustomer
                ? formatRuntime(summary.shortestRuntimeCustomer.estimatedRuntimeHours)
                : 'No usable pressure and flow'}
            </small>
          </span>
        </button>
      </section>

      <div className={styles.chartGrid}>
        <section className={styles.chartCard}>
          <header className={styles.cardHeader}>
            <div>
              <h3>Customer flow rates</h3>
              <p>Latest reported flow per customer · highest to lowest</p>
            </div>
            <Droplets size={16} />
          </header>
          {analytics.flowRanking.length ? (
            <div className={styles.rankingList}>
              {analytics.flowRanking.map((ranking, index) => (
                <button
                  type="button"
                  className={styles.rankingRow}
                  key={ranking.customerId}
                  onClick={() => onSelectCustomer(ranking.customerId)}
                >
                  <span className={styles.rankingNumber}>{index + 1}</span>
                  <span className={styles.rankingMain}>
                    <span className={styles.rankingLabel}>
                      <strong>{ranking.customerName}</strong>
                      <span>{ranking.flowRateScmPerHour.toLocaleString()} scm/h</span>
                    </span>
                    <span className={styles.rankingTrack}>
                      <span
                        style={{
                          width: `${(ranking.flowRateScmPerHour / maxFlow) * 100}%`,
                        }}
                      />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>No customer flow readings are available.</div>
          )}
        </section>
        <TrendChart
          title="Runtime trend"
          description="Shortest estimated PRMS runtime per customer update"
          points={analytics.runtimeTrend}
          unit="hours"
          color="#b37a21"
        />
      </div>

      <div className={styles.overviewLowerGrid}>
        <section className={styles.panel}>
          <header className={styles.cardHeader}>
            <div>
              <h3>Recent update activity</h3>
              <p>Latest messages in the selected period</p>
            </div>
            <Clock3 size={16} />
          </header>
          {analytics.recentUpdates.length ? (
            <div className={styles.activityList}>
              {analytics.recentUpdates.map((update) => (
                <button
                  type="button"
                  className={styles.activityRow}
                  key={update.id}
                  onClick={() => onSelectUpdate(update)}
                >
                  <span className={styles.activityCopy}>
                    <strong>{update.customerName}</strong>
                    <small>{formatDate(update.createdAt, true)}</small>
                  </span>
                  <span className={`${styles.badge} ${statusClass(update.processingStatus)}`}>
                    {statusLabel(update.processingStatus, update.isProcessed)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>No updates received in this period.</div>
          )}
        </section>
      </div>
    </>
  );
}

function CustomerReport({ customer }: { customer: CustomerSummary }) {
  const latest = customer.latestUpdate;
  const data = latest?.parsedData ?? null;
  if (!latest) {
    return (
      <div className={styles.emptyStateLarge}>
        <Droplets size={22} />
        <strong>No customer reports available</strong>
        <span>Awaiting the next report from {customer.name}.</span>
      </div>
    );
  }

  if (!data) {
    return (
      <>
        <section className={styles.reportHeader}>
          <div>
            <p className={styles.eyebrow}>Latest customer report</p>
            <h2>{customer.name}</h2>
            <p className={styles.reportMeta}>Received {formatDate(latest.createdAt, true)}</p>
          </div>
          <span className={`${styles.badge} ${statusClass(latest.processingStatus)}`}>
            {statusLabel(latest.processingStatus, latest.isProcessed)}
          </span>
        </section>
        <div className={styles.emptyStateLarge}>
          <AlertTriangle size={22} />
          <strong>Readings unavailable</strong>
          <span>
            {latest.warnings.length
              ? latest.warnings.map((warning) => warning.replaceAll('_', ' ')).join(' · ')
              : 'No PRMS readings were extracted from this update.'}
          </span>
        </div>
      </>
    );
  }

  return (
    <>
      <section className={styles.reportHeader}>
        <div>
          <p className={styles.eyebrow}>Latest customer report</p>
          <h2>{customer.name}</h2>
          <p className={styles.reportMeta}>
            Received {formatDate(latest.createdAt, true)}
            {data.reportedAt ? ` · Reported ${formatDate(data.reportedAt)}` : ''}
          </p>
        </div>
        <span className={`${styles.badge} ${statusClass(latest.processingStatus)}`}>
          {statusLabel(latest.processingStatus, latest.isProcessed)}
        </span>
      </section>

      {latest.warnings.length ? (
        <div className={styles.warningBox}>
          <strong>
            <AlertTriangle size={14} /> Review this update
          </strong>
          <span>{latest.warnings.map((warning) => warning.replaceAll('_', ' ')).join(' · ')}</span>
        </div>
      ) : null}

      <section className={styles.reportMetricGrid}>
        <article className={styles.reportMetric}>
          <span>Outlet pressure</span>
          <strong>{data.outletpressure === null ? '—' : `${data.outletpressure} bar`}</strong>
        </article>
        <article className={styles.reportMetric}>
          <span>Available trucks</span>
          <strong>
            {data.availabletrucks === null
              ? '—'
              : typeof data.availabletrucks === 'number'
                ? data.availabletrucks
                : data.availabletrucks.join(', ')}
          </strong>
        </article>
      </section>

      <section className={styles.panel}>
        <header className={styles.cardHeader}>
          <div>
            <h3>PRMS readings & runtime</h3>
            <p>Latest reported pressure, flow, and estimated runtime per PRMS</p>
          </div>
          <Gauge size={16} />
        </header>
        {latest.forecast?.prmsForecasts.length ? (
          <div className={styles.prmsGrid}>
            {latest.forecast.prmsForecasts.map((prms) => (
              <article
                className={`${styles.prmsCard} ${prms.status === 'needs_review' ? styles.prmsCardReview : prms.status === 'unavailable' ? styles.prmsCardUnavailable : ''}`}
                key={prms.prmsId}
              >
                <div className={styles.prmsCardHeader}>
                  <strong>PRMS {prms.prmsId}</strong>
                  <span
                    className={`${styles.badge} ${prms.status === 'estimated' ? styles.badgeOk : prms.status === 'needs_review' ? styles.badgeReview : styles.badgeFailed}`}
                  >
                    {statusLabel(prms.status)}
                  </span>
                </div>
                <strong className={styles.runtimeValue}>
                  {formatRuntime(prms.estimatedHoursRemaining)}
                </strong>
                <span className={styles.runtimeCaption}>estimated runtime</span>
                <div className={styles.prmsReadings}>
                  <span>
                    Pressure: {prms.pressureBar === null ? '—' : `${prms.pressureBar} bar`}
                  </span>
                  <span>
                    Flow:{' '}
                    {prms.flowRateScmPerHour === null ? '—' : `${prms.flowRateScmPerHour} scm/h`}
                  </span>
                  <span>
                    Skid{prms.skidNumbers.length === 1 ? '' : 's'}:{' '}
                    {prms.skidNumbers.length ? prms.skidNumbers.join(', ') : 'Not reported'}
                  </span>
                </div>
                {prms.warnings.length ? (
                  <p className={styles.prmsWarning}>
                    {prms.warnings.map((warning) => warning.replaceAll('_', ' ')).join(' · ')}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>No PRMS readings were extracted from this update.</div>
        )}
      </section>

      <section className={styles.skidStatusGrid}>
        <article className={styles.reportMetric}>
          <span>Standby skids</span>
          <strong>{listValue(data.standbyskid)}</strong>
        </article>
        <article className={styles.reportMetric}>
          <span>Empty skids</span>
          <strong>{listValue(data.emptyskid)}</strong>
        </article>
        <article className={styles.reportMetric}>
          <span>Skids in use</span>
          <strong>
            {listValue(
              data.PRMS.flatMap((prms) => {
                const value = prms.skidinuse;
                return value === null ? [] : Array.isArray(value) ? value : [value];
              })
            )}
          </strong>
        </article>
      </section>
    </>
  );
}

function UpdateDetail({ update }: { update: CustomerUpdateHistoryItem | null }) {
  if (!update) {
    return (
      <div className={styles.emptyStateLarge}>
        <CheckCircle2 size={21} />
        <strong>Select an update to review</strong>
        <span>Review the customer message, extracted readings, and warnings.</span>
      </div>
    );
  }

  const parsedData = update.parsedData;
  return (
    <section className={styles.historyDetail}>
      <header className={styles.reportHeader}>
        <div>
          <p className={styles.eyebrow}>{update.customerName}</p>
          <h2>Update details</h2>
          <p className={styles.reportMeta}>Received {formatDate(update.createdAt, true)}</p>
        </div>
        <span className={`${styles.badge} ${statusClass(update.processingStatus)}`}>
          {statusLabel(update.processingStatus, update.isProcessed)}
        </span>
      </header>

      {!update.isProcessed ? (
        <div className={styles.pendingBox}>
          <Clock3 size={14} /> Processing pending.
        </div>
      ) : null}
      {update.warnings.length ? (
        <div className={styles.warningBox}>
          <strong>
            <AlertTriangle size={14} /> Parser warnings
          </strong>
          <span>{update.warnings.map((warning) => warning.replaceAll('_', ' ')).join(' · ')}</span>
        </div>
      ) : null}

      <details className={styles.originalMessage} key={update.id}>
        <summary>Original customer message</summary>
        <pre>{update.text}</pre>
      </details>

      {parsedData ? (
        <>
          <h3 className={styles.sectionTitle}>Parsed readings</h3>
          <div className={styles.reportMetricGrid}>
            <article className={styles.reportMetric}>
              <span>Outlet pressure</span>
              <strong>
                {parsedData.outletpressure === null ? '—' : `${parsedData.outletpressure} bar`}
              </strong>
            </article>
            {parsedData.PRMS.map((prms) => (
              <article className={styles.reportMetric} key={prms.id}>
                <span>PRMS {prms.id} pressure</span>
                <strong>{prms.pressure === null ? '—' : `${prms.pressure} bar`}</strong>
              </article>
            ))}
            {parsedData.PRMS.map((prms) => (
              <article className={styles.reportMetric} key={`flow-${prms.id}`}>
                <span>PRMS {prms.id} flow</span>
                <strong>{prms.flowrate === null ? '—' : `${prms.flowrate} scm/h`}</strong>
              </article>
            ))}
          </div>
          {update.forecast?.prmsForecasts.length ? (
            <div className={styles.prmsGrid}>
              {update.forecast.prmsForecasts.map((prms) => (
                <article className={styles.prmsCard} key={prms.prmsId}>
                  <span className={styles.detailMeta}>PRMS {prms.prmsId} forecast</span>
                  <strong className={styles.runtimeValue}>
                    {formatRuntime(prms.estimatedHoursRemaining)}
                  </strong>
                  <span className={styles.runtimeCaption}>estimated runtime</span>
                </article>
              ))}
            </div>
          ) : update.processingStatus === 'failed' ? (
            <div className={styles.emptyState}>
              No forecast was generated for this failed update.
            </div>
          ) : null}
        </>
      ) : update.processingStatus === 'failed' ? (
        <div className={styles.emptyState}>No readings were extracted from this update.</div>
      ) : null}
    </section>
  );
}

function UpdateHistoryList({
  customerName,
  updates,
  selectedUpdateId,
  loading,
  page,
  pagination,
  onSelect,
  onPageChange,
}: {
  customerName: string;
  updates: CustomerUpdateHistoryItem[];
  selectedUpdateId: string | null;
  loading: boolean;
  page: number;
  pagination: PaginationMeta | null;
  onSelect: (update: CustomerUpdateHistoryItem) => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <section className={styles.historyListPanel}>
      <header className={styles.cardHeader}>
        <div>
          <h3>{customerName} updates</h3>
          <p>{pagination?.total ?? 0} matching updates</p>
        </div>
        <Waves size={16} />
      </header>
      <div className={styles.historyList}>
        {loading ? (
          <div className={styles.emptyState}>
            <RefreshCw size={17} className="animate-spin" /> Loading update history…
          </div>
        ) : updates.length ? (
          updates.map((update) => (
            <button
              type="button"
              className={`${styles.historyItem} ${selectedUpdateId === update.id ? styles.historyItemSelected : ''}`}
              key={update.id}
              onClick={() => onSelect(update)}
            >
              <span className={styles.historyItemTop}>
                <strong>{formatDate(update.createdAt, true)}</strong>
                <span className={`${styles.badge} ${statusClass(update.processingStatus)}`}>
                  {statusLabel(update.processingStatus, update.isProcessed)}
                </span>
              </span>
              <span className={styles.historyPreview}>{update.text}</span>
              <span className={styles.historyItemBottom}>
                {update.parsedData?.PRMS.length
                  ? `${update.parsedData.PRMS.length} PRMS readings`
                  : 'No parsed readings'}
                {update.warnings.length
                  ? ` · ${update.warnings.length} warning${update.warnings.length === 1 ? '' : 's'}`
                  : ''}
              </span>
            </button>
          ))
        ) : (
          <div className={styles.emptyState}>
            <CheckCircle2 size={18} />
            <strong>No matching updates</strong>
            <span>Adjust the date or status filters to see more results.</span>
          </div>
        )}
      </div>
      <footer className={styles.pagination}>
        <span>
          {pagination?.total
            ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, pagination.total)} of ${pagination.total}`
            : 'No results'}
        </span>
        <div>
          <button
            type="button"
            aria-label="Previous history page"
            disabled={!pagination?.hasPrevious || loading}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            aria-label="Next history page"
            disabled={!pagination?.hasNext || loading}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </footer>
    </section>
  );
}

export default function CustomerUpdatesDashboard() {
  const [period, setPeriod] = useState<CustomerUpdatePeriod>('7d');
  const [view, setView] = useState<CustomerView>('overview');
  const [analytics, setAnalytics] = useState<CustomerUpdateAnalytics | null>(null);
  const [customerAnalytics, setCustomerAnalytics] = useState<CustomerUpdateAnalytics | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState<CustomerFilter>('all');
  const [mobileCustomerDetailsOpen, setMobileCustomerDetailsOpen] = useState(false);
  const [history, setHistory] = useState<CustomerUpdateHistoryItem[]>([]);
  const [historyPagination, setHistoryPagination] = useState<PaginationMeta | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyStatus, setHistoryStatus] = useState<CustomerUpdateStatusFilter>('all');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const selectedUpdateRef = useRef<string | null>(null);
  const customerRequestRef = useRef(0);
  const historyRequestRef = useRef(0);
  const overviewErrorRef = useRef<string | null>(null);
  const customerErrorRef = useRef<string | null>(null);
  const historyErrorRef = useRef<string | null>(null);
  const focusCustomerReviewRef = useRef(false);
  const showToast = useToast();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'customer') setView('customer');
      if (params.get('customerFilter') === 'needs_review') {
        focusCustomerReviewRef.current = true;
        setCustomerFilter('needs-review');
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function handleAlertNavigation(event: Event) {
      const alert = (event as CustomEvent<{ id: string }>).detail;
      if (alert?.id !== 'customer-updates-review') return;
      focusCustomerReviewRef.current = true;
      setView('customer');
      setCustomerFilter('needs-review');
      setCustomerSearch('');
      setMobileCustomerDetailsOpen(false);
    }

    window.addEventListener('officer-alert-navigate', handleAlertNavigation);
    return () => window.removeEventListener('officer-alert-navigate', handleAlertNavigation);
  }, []);

  const refreshOverview = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const result = await getCustomerUpdatesAnalytics(period);
        setAnalytics(result);
        setError(null);
        overviewErrorRef.current = null;
        setLastUpdated(new Date());
        setSelectedCustomerId(
          (current) =>
            current ??
            [...result.customers].sort((a, b) => latestUpdateTime(b) - latestUpdateTime(a))[0]
              ?.id ??
            null
        );
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : 'Unable to load customer analytics.';
        setError(message);
        if (overviewErrorRef.current !== message) {
          overviewErrorRef.current = message;
          showToast({
            tone: 'error',
            title: 'Customer analytics unavailable',
            description: message,
          });
        }
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [period, showToast]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshOverview(view === 'overview'), 0);
    const interval = window.setInterval(() => void refreshOverview(), REFRESH_INTERVAL_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [refreshOverview, view]);

  useEffect(() => {
    if (customerFilter !== 'needs-review' || !analytics) return;
    const timer = window.setTimeout(() => {
      const selected = analytics.customers.find((customer) => customer.id === selectedCustomerId);
      if (!selected || !needsReview(selected)) {
        setSelectedCustomerId(analytics.customers.find(needsReview)?.id ?? null);
      }
      setMobileCustomerDetailsOpen(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [analytics, customerFilter, selectedCustomerId]);

  useEffect(() => {
    if (!focusCustomerReviewRef.current || !analytics || view !== 'customer') return;
    focusCustomerReviewRef.current = false;
    const timer = window.setTimeout(
      () => document.getElementById('customer-updates-review')?.scrollIntoView({ block: 'start' }),
      0
    );
    return () => window.clearTimeout(timer);
  }, [analytics, view]);

  useEffect(() => {
    const requestId = ++customerRequestRef.current;
    if (view !== 'customer' || !selectedCustomerId) {
      const timer = window.setTimeout(() => {
        setCustomerAnalytics(null);
        customerErrorRef.current = null;
        setCustomerLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      setCustomerAnalytics(null);
      setCustomerLoading(true);
      customerErrorRef.current = null;
      void getCustomerAnalytics(selectedCustomerId, period)
        .then((result) => {
          if (customerRequestRef.current === requestId) setCustomerAnalytics(result);
        })
        .catch((loadError: unknown) => {
          if (customerRequestRef.current === requestId) {
            const message =
              loadError instanceof Error ? loadError.message : 'Unable to load customer analytics.';
            if (customerErrorRef.current !== message) {
              customerErrorRef.current = message;
              showToast({
                tone: 'error',
                title: 'Customer report unavailable',
                description: message,
              });
            }
          }
        })
        .finally(() => {
          if (customerRequestRef.current === requestId) setCustomerLoading(false);
        });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [period, selectedCustomerId, showToast, view]);

  const refreshHistory = useCallback(
    async (showLoading = false) => {
      if (!selectedCustomerId) {
        setHistory([]);
        setHistoryPagination(null);
        return;
      }
      if (showLoading) setHistoryLoading(true);
      const requestId = ++historyRequestRef.current;
      try {
        const result = await listCustomerUpdateHistory({
          customerId: selectedCustomerId,
          page: historyPage,
          limit: PAGE_SIZE,
          from: historyFrom || undefined,
          to: historyTo || undefined,
          status: historyStatus,
        });
        if (historyRequestRef.current !== requestId) return;
        setHistory(result.updates);
        setHistoryPagination(result.pagination);
        historyErrorRef.current = null;
        const nextSelected =
          result.updates.find((item) => item.id === selectedUpdateRef.current) ??
          result.updates[0] ??
          null;
        selectedUpdateRef.current = nextSelected?.id ?? null;
        setSelectedUpdateId(nextSelected?.id ?? null);
      } catch (loadError) {
        if (historyRequestRef.current === requestId) {
          const message =
            loadError instanceof Error ? loadError.message : 'Unable to load update history.';
          if (historyErrorRef.current !== message) {
            historyErrorRef.current = message;
            showToast({
              tone: 'error',
              title: 'Customer update history unavailable',
              description: message,
            });
          }
        }
      } finally {
        if (showLoading && historyRequestRef.current === requestId) setHistoryLoading(false);
      }
    },
    [historyFrom, historyPage, historyStatus, historyTo, selectedCustomerId, showToast]
  );

  useEffect(() => {
    if (view !== 'history') return;
    const timer = window.setTimeout(() => void refreshHistory(true), 0);
    const interval = window.setInterval(() => void refreshHistory(), REFRESH_INTERVAL_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [refreshHistory, view]);

  const customers = analytics?.customers ?? [];
  const selectedCustomer =
    customerFilter === 'needs-review'
      ? (customers.find(
          (customer) => customer.id === selectedCustomerId && needsReview(customer)
        ) ??
        customers.find(needsReview) ??
        null)
      : (customers.find((customer) => customer.id === selectedCustomerId) ?? customers[0] ?? null);
  const detailedCustomer =
    customerAnalytics?.customers.find((customer) => customer.id === selectedCustomerId) ??
    selectedCustomer;
  const selectedUpdate = history.find((update) => update.id === selectedUpdateId) ?? null;

  function chooseCustomer(customerId: string) {
    setSelectedCustomerId(customerId);
    setMobileCustomerDetailsOpen(true);
    setHistoryPage(1);
    selectedUpdateRef.current = null;
    setSelectedUpdateId(null);
  }

  function chooseUpdate(update: CustomerUpdateHistoryItem) {
    selectedUpdateRef.current = update.id;
    setSelectedUpdateId(update.id);
  }

  function openUpdateFromOverview(update: CustomerUpdateHistoryItem) {
    chooseCustomer(update.customerId);
    setView('history');
  }

  return (
    <div className={styles.shell}>
      <OperationsSidebar active="updates" />
      <main className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.breadcrumb}>
            <span>Operations</span>
            <span>/</span>
            <strong>Customer updates</strong>
          </div>
          <div className={styles.refreshInfo}>
            <span className={`${styles.liveDot} ${error ? styles.liveDotError : ''}`} />
            {error
              ? 'Analytics refresh failed'
              : lastUpdated
                ? `Updated ${formatDate(lastUpdated.toISOString(), true)}`
                : 'Loading customer data…'}
          </div>
        </div>

        <header className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>Customer monitoring</p>
            <h1 className={styles.title}>Customer updates & analytics</h1>
            <p className={styles.subtitle}>
              Monitor customer reports, PRMS performance, and processing history.
            </p>
          </div>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => {
              void refreshOverview(true);
              if (view === 'history') void refreshHistory(true);
            }}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} /> Refresh
          </button>
        </header>

        <div className={styles.pageToolbar}>
          <div className={styles.viewTabs} role="tablist" aria-label="Customer update view">
            {(['overview', 'customer', 'history'] as const).map((tab) => (
              <button
                type="button"
                role="tab"
                aria-selected={view === tab}
                className={`${styles.viewTab} ${view === tab ? styles.viewTabActive : ''}`}
                key={tab}
                onClick={() => {
                  setView(tab);
                  setMobileCustomerDetailsOpen(false);
                }}
              >
                {tab === 'overview'
                  ? 'Overview'
                  : tab === 'customer'
                    ? 'Customer details'
                    : 'Update history'}
              </button>
            ))}
          </div>
          {view !== 'history' ? (
            <div className={styles.periodControls} aria-label="Analytics period">
              {(['24h', '7d', '30d'] as const).map((option) => (
                <button
                  type="button"
                  key={option}
                  className={`${styles.periodButton} ${period === option ? styles.periodButtonActive : ''}`}
                  aria-pressed={period === option}
                  onClick={() => setPeriod(option)}
                >
                  {option === '24h' ? '24 hours' : option === '7d' ? '7 days' : '30 days'}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {loading && !analytics ? (
          <div className={styles.loadingState}>
            <RefreshCw size={17} className="animate-spin" /> Loading customer analytics…
          </div>
        ) : !analytics ? (
          <div className={styles.emptyStateLarge}>Customer analytics are unavailable.</div>
        ) : view === 'overview' ? (
          <OverviewPanel
            analytics={analytics}
            onSelectCustomer={(id) => {
              setCustomerSearch('');
              chooseCustomer(id);
              setView('customer');
            }}
            onSelectUpdate={openUpdateFromOverview}
          />
        ) : view === 'customer' ? (
          <div
            className={`${styles.customerWorkspace} ${mobileCustomerDetailsOpen ? styles.customerWorkspaceDetailOpen : ''}`}
          >
            <CustomerSelector
              customers={customers}
              flowRanking={analytics.flowRanking}
              selectedCustomerId={selectedCustomer?.id ?? null}
              search={customerSearch}
              customerFilter={customerFilter}
              onSearch={setCustomerSearch}
              onCustomerFilterChange={(filter) => {
                setCustomerFilter(filter);
                setMobileCustomerDetailsOpen(false);
              }}
              onSelect={chooseCustomer}
            />
            <section className={styles.customerContent}>
              <button
                type="button"
                className={styles.mobileCustomerBack}
                onClick={() => setMobileCustomerDetailsOpen(false)}
              >
                <ChevronLeft size={15} /> Back to customers
              </button>
              {customerLoading && !customerAnalytics ? (
                <div className={styles.loadingState}>
                  <RefreshCw size={17} className="animate-spin" /> Loading customer report…
                </div>
              ) : detailedCustomer ? (
                <>
                  <CustomerReport customer={detailedCustomer} />
                  {customerAnalytics ? (
                    <div className={styles.chartGrid}>
                      <TrendChart
                        title="Pressure trend"
                        description="Average PRMS pressure per update"
                        points={customerAnalytics.pressureTrend}
                        unit="bar"
                        color="#327f58"
                      />
                      <TrendChart
                        title="Flow rate trend"
                        description="PRMS flow rate per update"
                        points={customerAnalytics.flowTrend}
                        unit="scm/h"
                        color="#3977a1"
                      />
                      <TrendChart
                        title="Runtime trend"
                        description="Shortest estimated PRMS runtime per update"
                        points={customerAnalytics.runtimeTrend}
                        unit="hours"
                        color="#b37a21"
                      />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className={styles.historyLink}
                    onClick={() => {
                      setHistoryPage(1);
                      setView('history');
                    }}
                  >
                    View {selectedCustomer?.name ?? 'customer'} update history
                    <ChevronRight size={15} />
                  </button>
                </>
              ) : (
                <div className={styles.emptyStateLarge}>Select a customer to review reports.</div>
              )}
            </section>
          </div>
        ) : (
          <div className={styles.historyWorkspace}>
            <CustomerSelector
              customers={customers}
              flowRanking={analytics.flowRanking}
              selectedCustomerId={selectedCustomer?.id ?? null}
              search={customerSearch}
              customerFilter={customerFilter}
              onSearch={setCustomerSearch}
              onCustomerFilterChange={setCustomerFilter}
              onSelect={chooseCustomer}
            />
            <section className={styles.historyContent}>
              <div className={styles.historyFilters}>
                <label>
                  <span>From</span>
                  <input
                    type="date"
                    value={historyFrom}
                    onChange={(event) => {
                      setHistoryFrom(event.target.value);
                      setHistoryPage(1);
                    }}
                  />
                </label>
                <label>
                  <span>To</span>
                  <input
                    type="date"
                    value={historyTo}
                    onChange={(event) => {
                      setHistoryTo(event.target.value);
                      setHistoryPage(1);
                    }}
                  />
                </label>
                <label>
                  <span>Processing status</span>
                  <select
                    value={historyStatus}
                    onChange={(event) => {
                      setHistoryStatus(event.target.value as CustomerUpdateStatusFilter);
                      setHistoryPage(1);
                    }}
                  >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="ok">Processed</option>
                    <option value="needs_review">Needs review</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>
                {historyFrom || historyTo || historyStatus !== 'all' ? (
                  <button
                    className={styles.clearFilters}
                    type="button"
                    onClick={() => {
                      setHistoryFrom('');
                      setHistoryTo('');
                      setHistoryStatus('all');
                      setHistoryPage(1);
                    }}
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>

              <div className={styles.historyLayout}>
                <UpdateHistoryList
                  customerName={selectedCustomer?.name ?? 'Customer'}
                  updates={history}
                  selectedUpdateId={selectedUpdateId}
                  loading={historyLoading}
                  page={historyPage}
                  pagination={historyPagination}
                  onSelect={chooseUpdate}
                  onPageChange={setHistoryPage}
                />
                <UpdateDetail update={selectedUpdate} />
              </div>
            </section>
          </div>
        )}

        <p className={styles.footerNote}>
          Runtime uses reported PRMS pressure and flow for estimation only. Updates marked for
          review or failed parsing should be checked before operational decisions.
        </p>
      </main>
    </div>
  );
}
