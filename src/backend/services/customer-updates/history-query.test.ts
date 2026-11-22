import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCustomerUpdateHistoryQuery } from './history-query';

test('parses customer, status, pagination, and inclusive date range filters', () => {
  const parsed = parseCustomerUpdateHistoryQuery(
    new URLSearchParams({
      customerId: '4a2bb08a-1625-4db4-b435-e75b902631a1',
      from: '2025-03-01',
      to: '2025-03-04',
      status: 'pending',
      page: '2',
      limit: '15',
    })
  );

  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.customerId, '4a2bb08a-1625-4db4-b435-e75b902631a1');
  assert.equal(parsed.data.page, 2);
  assert.equal(parsed.data.limit, 15);
  assert.equal(parsed.data.status, 'pending');
  assert.equal(parsed.data.from?.toISOString(), '2025-03-01T00:00:00.000Z');
  assert.equal(parsed.data.toExclusive?.toISOString(), '2025-03-05T00:00:00.000Z');
});

test('rejects invalid calendar dates, reversed ranges, and unsupported statuses', () => {
  for (const params of [
    new URLSearchParams({ from: '2025-02-31' }),
    new URLSearchParams({ from: '2025-03-02', to: '2025-03-01' }),
    new URLSearchParams({ status: 'archived' }),
    new URLSearchParams({ page: '0' }),
  ]) {
    assert.equal(parseCustomerUpdateHistoryQuery(params).success, false);
  }
});

test('uses bounded defaults when history filters are omitted', () => {
  const parsed = parseCustomerUpdateHistoryQuery(new URLSearchParams());

  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.page, 1);
  assert.equal(parsed.data.limit, 25);
  assert.equal(parsed.data.status, 'all');
  assert.equal(parsed.data.from, undefined);
  assert.equal(parsed.data.toExclusive, undefined);
});
