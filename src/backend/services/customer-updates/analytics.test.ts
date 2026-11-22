import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCustomerUpdateAnalytics } from './analytics';

type CustomerRow = Parameters<typeof buildCustomerUpdateAnalytics>[1][number];
type AnalyticsRow = Parameters<typeof buildCustomerUpdateAnalytics>[2][number];

const noReadings = {
  PRMS: [],
  outletpressure: null,
  standbyskid: null,
  emptyskid: null,
  availabletrucks: null,
  reportedAt: null,
};

function customer(id: string, isActive = true): CustomerRow {
  return { id, name: `Customer ${id}`, location: null, isActive };
}

function update(
  id: string,
  customerId: string,
  processingStatus: AnalyticsRow['processingStatus'],
  data: unknown,
  createdAt = new Date('2025-03-01T10:00:00.000Z')
): AnalyticsRow {
  return {
    id,
    customerId,
    customerName: `Customer ${customerId}`,
    text: `Incoming report ${id}`,
    createdAt,
    isProcessed: processingStatus !== null,
    processingStatus,
    warnings: processingStatus === 'needs_review' ? ['missing_totalflow'] : [],
    parsedData: data,
  };
}

test('returns stable zero analytics for customers with no update history', () => {
  const result = buildCustomerUpdateAnalytics('7d', [customer('a'), customer('b', false)], [], []);

  assert.deepEqual(result.summary, {
    activeCustomerCount: 1,
    totalUpdates: 0,
    customersNeedingReview: 0,
    shortestRuntimeCustomer: null,
  });
  assert.deepEqual(result.runtimeTrend, []);
  assert.deepEqual(result.flowRanking, []);
  assert.deepEqual(result.recentUpdates, []);
});

test('omits unavailable metrics when processed reports have no PRMS readings', () => {
  const latest = update('empty-report', 'a', 'ok', noReadings);
  const result = buildCustomerUpdateAnalytics('24h', [customer('a')], [latest], [latest]);

  assert.equal(result.customers[0].estimatedRuntimeHours, null);
  assert.equal('latestFlowScmPerHour' in result.customers[0], false);
  assert.equal('averagePressureBar' in result.customers[0], false);
  assert.equal('combinedFlowScmPerHour' in result.summary, false);
  assert.deepEqual(result.pressureTrend, []);
  assert.deepEqual(result.flowTrend, []);
  assert.equal(result.recentUpdates[0].forecast?.prmsForecasts.length, 0);
});

test('keeps pressure, flow, and runtime trends for reviewed and failed reports', () => {
  const pressureFlowData = {
    ...noReadings,
    PRMS: [
      {
        id: 1,
        pressure: 20,
        flowrate: 500,
        totalflow: null,
        skidinuse: 'SKID123',
      },
      {
        id: 2,
        pressure: 40,
        flowrate: 1000,
        totalflow: null,
        skidinuse: 'SKID456',
      },
    ],
  };
  const reviewed = update('reviewed', 'a', 'needs_review', pressureFlowData);
  const highFlowData = {
    ...noReadings,
    PRMS: [
      {
        id: 1,
        pressure: 60,
        flowrate: 1500,
        totalflow: null,
        skidinuse: 'SKID789',
      },
      {
        id: 2,
        pressure: 40,
        flowrate: 1000,
        totalflow: null,
        skidinuse: 'SKID012',
      },
    ],
  };
  const failed = update(
    'failed',
    'b',
    'failed',
    highFlowData,
    new Date('2025-03-01T11:00:00.000Z')
  );
  const result = buildCustomerUpdateAnalytics(
    '30d',
    [customer('a'), customer('b')],
    [reviewed, failed],
    [reviewed, failed]
  );

  assert.equal(result.summary.customersNeedingReview, 2);
  assert.deepEqual(
    result.pressureTrend.map((point) => point.value),
    [30, 50]
  );
  assert.deepEqual(
    result.flowTrend.map((point) => point.value),
    [1500, 2500]
  );
  assert.deepEqual(
    result.pressureTrend.map((point) => point.status),
    ['needs_review', 'failed']
  );
  assert.deepEqual(
    result.flowTrend.map((point) => point.status),
    ['needs_review', 'failed']
  );
  assert.deepEqual(
    result.runtimeTrend.map((point) => point.status),
    ['needs_review', 'failed']
  );
  assert.deepEqual(
    result.flowRanking.map((customer) => customer.customerId),
    ['b', 'a']
  );
  assert.deepEqual(
    result.flowRanking.map((customer) => customer.flowRateScmPerHour),
    [2500, 1500]
  );
  assert.equal(result.summary.shortestRuntimeCustomer?.customerId, 'a');
  assert.equal(result.recentUpdates.length, 2);
  assert.equal(result.recentUpdates[0].id, 'failed');
  assert.equal(result.recentUpdates[0].forecast?.messageId, 'failed');
  assert.equal(result.recentUpdates[0].forecast?.parseStatus, 'failed');
});
