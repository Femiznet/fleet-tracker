import { and, asc, desc, eq, gte, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { db } from '@/backend/db';
import { customers, messages, processedMessages } from '@/backend/db/schema';
import { calculateCustomerUpdateForecast } from '@/backend/services/messages/forecast';
import {
  CustomerUpdateMessageSchema,
  type CustomerUpdateMessage,
} from '@/backend/services/messages/utils/updateParser';

export type CustomerUpdatePeriod = '24h' | '7d' | '30d';
export type CustomerUpdateStatus = 'pending' | 'ok' | 'needs_review' | 'failed';
export type CustomerUpdateStatusFilter = 'all' | CustomerUpdateStatus;

const PERIOD_HOURS: Record<CustomerUpdatePeriod, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};

type UpdateRow = {
  id: string;
  customerId: string;
  customerName: string;
  text: string;
  createdAt: Date | null;
  isProcessed: boolean;
  processingStatus: 'ok' | 'needs_review' | 'failed' | null;
  warnings: string[] | null;
  parsedData: unknown;
};

function parseUpdateData(value: unknown): CustomerUpdateMessage | null {
  if (value === null || value === undefined) return null;
  const parsed = CustomerUpdateMessageSchema.safeParse(value);
  if (!parsed.success) throw new Error('Stored customer update data is invalid');
  return parsed.data;
}

function getForecast(row: UpdateRow, data: CustomerUpdateMessage | null) {
  if (!data || !row.processingStatus) return null;
  return calculateCustomerUpdateForecast({
    messageId: row.id,
    receivedAt: row.createdAt,
    parseStatus: row.processingStatus,
    warnings: row.warnings ?? [],
    data,
  });
}

function toHistoryItem(row: UpdateRow) {
  const parsedData = parseUpdateData(row.parsedData);
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: row.customerName,
    text: row.text,
    createdAt: row.createdAt,
    isProcessed: row.isProcessed,
    processingStatus: row.processingStatus,
    warnings: row.warnings ?? [],
    parsedData,
    forecast: getForecast(row, parsedData),
  };
}

function toLatestUpdate(row: UpdateRow) {
  const parsedData = parseUpdateData(row.parsedData);
  return {
    messageId: row.id,
    createdAt: row.createdAt,
    isProcessed: row.isProcessed,
    processingStatus: row.processingStatus ?? (row.isProcessed ? null : 'pending'),
    warnings: row.warnings ?? [],
    parsedData,
    forecast: getForecast(row, parsedData),
  };
}

function flowTotal(data: CustomerUpdateMessage | null) {
  if (!data) return null;
  const values = data.PRMS.map((prms) => prms.flowrate).filter(
    (value): value is number => value !== null
  );
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
}

function averagePressure(data: CustomerUpdateMessage | null) {
  if (!data) return null;
  const values = data.PRMS.map((prms) => prms.pressure).filter(
    (value): value is number => value !== null
  );
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function minimumRuntime(
  data: CustomerUpdateMessage | null,
  forecast: ReturnType<typeof getForecast>
) {
  if (!data || !forecast) return null;
  const values = forecast.prmsForecasts
    .map((prms) => prms.estimatedHoursRemaining)
    .filter((value): value is number => value !== null);
  return values.length ? Math.min(...values) : null;
}

function toTrendPoint(row: UpdateRow, metric: 'pressure' | 'flow' | 'runtime') {
  const data = parseUpdateData(row.parsedData);
  if (!data || !row.createdAt) return null;
  let value: number | null;
  if (metric === 'pressure') {
    value = averagePressure(data);
  } else if (metric === 'flow') {
    value = flowTotal(data);
  } else {
    value = minimumRuntime(data, getForecast(row, data));
  }
  if (value === null) return null;
  return {
    timestamp: row.createdAt,
    customerId: row.customerId,
    customerName: row.customerName,
    value,
    status: row.processingStatus,
  };
}

export async function listCustomerUpdateHistory(input: {
  page: number;
  limit: number;
  customerId?: string;
  from?: Date;
  toExclusive?: Date;
  status?: CustomerUpdateStatusFilter;
}) {
  const offset = (input.page - 1) * input.limit;
  const statusFilter =
    input.status === 'pending'
      ? or(eq(messages.isProcessed, false), isNull(processedMessages.status))
      : input.status && input.status !== 'all'
        ? eq(processedMessages.status, input.status)
        : undefined;
  const filters = [
    eq(messages.type, 'update'),
    input.customerId ? eq(messages.customerId, input.customerId) : undefined,
    input.from ? gte(messages.createdAt, input.from) : undefined,
    input.toExclusive ? lt(messages.createdAt, input.toExclusive) : undefined,
    statusFilter,
  ].filter((filter): filter is NonNullable<typeof filter> => filter !== undefined);
  const where = and(...filters);

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: messages.id,
        customerId: messages.customerId,
        customerName: customers.name,
        text: messages.text,
        createdAt: messages.createdAt,
        isProcessed: messages.isProcessed,
        processingStatus: processedMessages.status,
        warnings: processedMessages.warnings,
        parsedData: processedMessages.data,
      })
      .from(messages)
      .innerJoin(customers, eq(customers.id, messages.customerId))
      .leftJoin(processedMessages, eq(processedMessages.messageId, messages.id))
      .where(where)
      .orderBy(desc(messages.createdAt))
      .limit(input.limit)
      .offset(offset),
    db
      .select({ value: sql<number>`count(*)` })
      .from(messages)
      .leftJoin(processedMessages, eq(processedMessages.messageId, messages.id))
      .where(where),
  ]);

  return {
    rows: rows.map((row) => toHistoryItem(row as UpdateRow)),
    total: Number(countRows[0]?.value ?? 0),
  };
}

export async function getCustomerUpdateAnalytics(
  period: CustomerUpdatePeriod,
  customerId?: string
) {
  const now = new Date();
  const periodStart = new Date(now.getTime() - PERIOD_HOURS[period] * 60 * 60 * 1000);
  const customerFilter = customerId ? eq(customers.id, customerId) : undefined;
  const updateCustomerFilter = customerId ? eq(messages.customerId, customerId) : undefined;

  const [customerRows, latestRows, periodRows] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        location: customers.location,
        isActive: customers.isActive,
      })
      .from(customers)
      .where(customerFilter)
      .orderBy(asc(customers.name)),
    db
      .selectDistinctOn([messages.customerId], {
        id: messages.id,
        customerId: messages.customerId,
        customerName: customers.name,
        text: messages.text,
        createdAt: messages.createdAt,
        isProcessed: messages.isProcessed,
        processingStatus: processedMessages.status,
        warnings: processedMessages.warnings,
        parsedData: processedMessages.data,
      })
      .from(messages)
      .innerJoin(customers, eq(customers.id, messages.customerId))
      .leftJoin(processedMessages, eq(processedMessages.messageId, messages.id))
      .where(and(eq(messages.type, 'update'), updateCustomerFilter))
      .orderBy(messages.customerId, desc(messages.createdAt)),
    db
      .select({
        id: messages.id,
        customerId: messages.customerId,
        customerName: customers.name,
        text: messages.text,
        createdAt: messages.createdAt,
        isProcessed: messages.isProcessed,
        processingStatus: processedMessages.status,
        warnings: processedMessages.warnings,
        parsedData: processedMessages.data,
      })
      .from(messages)
      .innerJoin(customers, eq(customers.id, messages.customerId))
      .leftJoin(processedMessages, eq(processedMessages.messageId, messages.id))
      .where(
        and(
          eq(messages.type, 'update'),
          gte(messages.createdAt, periodStart),
          lte(messages.createdAt, now),
          updateCustomerFilter
        )
      )
      .orderBy(asc(messages.createdAt)),
  ]);

  return buildCustomerUpdateAnalytics(
    period,
    customerRows,
    latestRows as UpdateRow[],
    periodRows as UpdateRow[]
  );
}

type CustomerRow = {
  id: string;
  name: string;
  location: string | null;
  isActive: boolean;
};

export function buildCustomerUpdateAnalytics(
  period: CustomerUpdatePeriod,
  customerRows: CustomerRow[],
  latestRows: UpdateRow[],
  periodRows: UpdateRow[]
) {
  const latestByCustomer = new Map(latestRows.map((row) => [row.customerId, toLatestUpdate(row)]));
  const customerSummaries = customerRows.map((customer) => {
    const latestUpdate = latestByCustomer.get(customer.id) ?? null;
    return {
      ...customer,
      latestUpdate,
      latestFlowScmPerHour: flowTotal(latestUpdate?.parsedData ?? null),
      averagePressureBar: averagePressure(latestUpdate?.parsedData ?? null),
      estimatedRuntimeHours: minimumRuntime(
        latestUpdate?.parsedData ?? null,
        latestUpdate?.forecast ?? null
      ),
    };
  });

  const latestReportsNeedingReview = customerSummaries.filter(
    (customer) =>
      customer.latestUpdate?.processingStatus === 'needs_review' ||
      customer.latestUpdate?.processingStatus === 'failed'
  ).length;
  const flowRanking = customerSummaries
    .filter(
      (customer): customer is typeof customer & { latestFlowScmPerHour: number } =>
        customer.latestFlowScmPerHour !== null
    )
    .sort((a, b) => b.latestFlowScmPerHour - a.latestFlowScmPerHour)
    .map((customer) => ({
      customerId: customer.id,
      customerName: customer.name,
      flowRateScmPerHour: customer.latestFlowScmPerHour,
      estimatedRuntimeHours: customer.estimatedRuntimeHours,
    }));

  const pressureValues = customerSummaries
    .map((customer) => customer.averagePressureBar)
    .filter((value): value is number => value !== null);
  const combinedFlow = flowRanking.reduce(
    (total, customer) => total + customer.flowRateScmPerHour,
    0
  );
  const sortedRuntimes = customerSummaries
    .filter(
      (customer): customer is typeof customer & { estimatedRuntimeHours: number } =>
        customer.estimatedRuntimeHours !== null
    )
    .sort((a, b) => a.estimatedRuntimeHours - b.estimatedRuntimeHours);

  const recentRows = [...periodRows].sort(
    (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
  );

  return {
    period,
    summary: {
      activeCustomerCount: customerRows.filter((customer) => customer.isActive).length,
      totalUpdates: periodRows.length,
      combinedFlowScmPerHour: combinedFlow,
      averagePressureBar: pressureValues.length
        ? pressureValues.reduce((total, value) => total + value, 0) / pressureValues.length
        : null,
      customersNeedingReview: latestReportsNeedingReview,
      highestFlowCustomer: flowRanking[0] ?? null,
      shortestRuntimeCustomer: sortedRuntimes[0]
        ? {
            customerId: sortedRuntimes[0].id,
            customerName: sortedRuntimes[0].name,
            estimatedRuntimeHours: sortedRuntimes[0].estimatedRuntimeHours,
          }
        : null,
    },
    customers: customerSummaries,
    pressureTrend: periodRows
      .map((row) => toTrendPoint(row, 'pressure'))
      .filter((point): point is NonNullable<typeof point> => point !== null),
    flowTrend: periodRows
      .map((row) => toTrendPoint(row, 'flow'))
      .filter((point): point is NonNullable<typeof point> => point !== null),
    runtimeTrend: periodRows
      .map((row) => toTrendPoint(row, 'runtime'))
      .filter((point): point is NonNullable<typeof point> => point !== null),
    flowRanking,
    recentUpdates: recentRows.slice(0, 10).map((row) => toHistoryItem(row)),
  };
}
