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
    combinedFlowScmPerHour: 0,
    averagePressureBar: null,
    customersNeedingReview: 0,
    highestFlowCustomer: null,
    shortestRuntimeCustomer: null,
  });
  assert.deepEqual(result.pressureTrend, []);
  assert.deepEqual(result.flowTrend, []);
  assert.deepEqual(result.runtimeTrend, []);
  assert.deepEqual(result.recentUpdates, []);
});

test('omits unavailable metrics when processed reports have no PRMS readings', () => {
  const latest = update('empty-report', 'a', 'ok', noReadings);
  const result = buildCustomerUpdateAnalytics('24h', [customer('a')], [latest], [latest]);

  assert.equal(result.customers[0].latestFlowScmPerHour, null);
  assert.equal(result.customers[0].averagePressureBar, null);
  assert.equal(result.customers[0].estimatedRuntimeHours, null);
  assert.equal(result.summary.combinedFlowScmPerHour, 0);
  assert.equal(result.summary.averagePressureBar, null);
  assert.deepEqual(result.flowRanking, []);
  assert.deepEqual(result.pressureTrend, []);
  assert.equal(result.recentUpdates[0].forecast?.prmsForecasts.length, 0);
});

test('counts review and failed latest reports while retaining their trend status', () => {
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
    ],
  };
  const reviewed = update('reviewed', 'a', 'needs_review', pressureFlowData);
  const failed = update(
    'failed',
    'b',
    'failed',
    pressureFlowData,
    new Date('2025-03-01T11:00:00.000Z')
  );
  const result = buildCustomerUpdateAnalytics(
    '30d',
    [customer('a'), customer('b')],
    [reviewed, failed],
    [reviewed, failed]
  );

  assert.equal(result.summary.customersNeedingReview, 2);
  assert.equal(result.summary.combinedFlowScmPerHour, 1000);
  assert.deepEqual(
    result.flowTrend.map((point) => point.status),
    ['needs_review', 'failed']
  );
  assert.equal(result.summary.highestFlowCustomer?.customerId, 'a');
  assert.equal(result.summary.shortestRuntimeCustomer?.customerId, 'a');
  assert.equal(result.recentUpdates.length, 2);
  assert.equal(result.recentUpdates[0].id, 'failed');
  assert.equal(result.recentUpdates[0].forecast?.messageId, 'failed');
  assert.equal(result.recentUpdates[0].forecast?.parseStatus, 'failed');
});
