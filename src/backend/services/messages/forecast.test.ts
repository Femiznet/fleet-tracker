import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCustomerUpdateForecast, formatForecastDuration } from './forecast';
import type { CustomerUpdateMessage } from './utils/updateParser';

const update: CustomerUpdateMessage = {
  PRMS: [{
    id: 1,
    pressure: 30,
    flowrate: 900,
    totalflow: 1200,
    skidinuse: 'SKID123',
  }],
  outletpressure: null,
  standbyskid: null,
  emptyskid: null,
  availabletrucks: null,
  reportedAt: null,
};

test('estimates remaining hours from pressure and flow rate', () => {
  const forecast = calculateCustomerUpdateForecast({
    messageId: 'message-1',
    receivedAt: null,
    parseStatus: 'ok',
    warnings: [],
    data: update,
  });

  assert.equal(forecast.prmsForecasts[0].estimatedHoursRemaining, 30 * 28 / 900);
  assert.equal(forecast.prmsForecasts[0].estimatedTimeRemaining, '0h:56mins');
  assert.equal(forecast.prmsForecasts[0].status, 'estimated');
  assert.deepEqual(forecast.prmsForecasts[0].skidNumbers, ['SKID123']);
});

test('does not estimate when the flow rate is zero', () => {
  const forecast = calculateCustomerUpdateForecast({
    messageId: 'message-2',
    receivedAt: null,
    parseStatus: 'ok',
    warnings: [],
    data: { ...update, PRMS: [{ ...update.PRMS[0], flowrate: 0 }] },
  });

  assert.equal(forecast.prmsForecasts[0].estimatedHoursRemaining, null);
  assert.equal(forecast.prmsForecasts[0].estimatedTimeRemaining, null);
  assert.equal(forecast.prmsForecasts[0].status, 'unavailable');
  assert.deepEqual(forecast.prmsForecasts[0].warnings, ['flowrate_must_be_positive']);
});

test('marks estimates from flagged updates for review', () => {
  const forecast = calculateCustomerUpdateForecast({
    messageId: 'message-3',
    receivedAt: null,
    parseStatus: 'needs_review',
    warnings: ['totalflow_decreased'],
    data: update,
  });

  assert.equal(forecast.prmsForecasts[0].estimatedHoursRemaining, 30 * 28 / 900);
  assert.equal(forecast.prmsForecasts[0].estimatedTimeRemaining, '0h:56mins');
  assert.equal(forecast.prmsForecasts[0].status, 'needs_review');
  assert.deepEqual(forecast.warnings, ['totalflow_decreased']);
});

test('formats rounded minutes and carries an hour overflow', () => {
  assert.equal(formatForecastDuration(1.5), '1h:30mins');
  assert.equal(formatForecastDuration(1 + 59.6 / 60), '2h:00mins');
  assert.equal(formatForecastDuration(null), null);
});
