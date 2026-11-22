import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDispatchFingerprint,
  formatDispatchNotification,
  matchesDispatchNotification,
} from './dispatch-review';
import type { DispatchDetails } from './utils/dispatchParser';

const details: DispatchDetails = {
  truckNumber: 'TRUCK-12',
  skidNumber: 'SKID123',
  driverName: 'Ada Driver',
  customerName: 'Customer',
  dateOut: '2026-11-21',
  timeOut: '14:30',
  driverContact: '+2348012345678',
};

test('duplicate fingerprint uses customer, truck, skid, and dispatch date', () => {
  assert.equal(
    createDispatchFingerprint('customer-1', details),
    createDispatchFingerprint('customer-1', { ...details, truckNumber: ' truck-12 ' })
  );
  assert.notEqual(
    createDispatchFingerprint('customer-1', details),
    createDispatchFingerprint('customer-1', { ...details, dateOut: '2026-11-22' })
  );
  assert.notEqual(
    createDispatchFingerprint('customer-1', details),
    createDispatchFingerprint('customer-2', details)
  );
  assert.equal(createDispatchFingerprint('customer-1', { ...details, dateOut: null }), null);
});

test('generates the approved copy-ready dispatch notice', () => {
  assert.equal(
    formatDispatchNotification(details),
    [
      '*Truck/Skid Dispatch Details*',
      '*Truck Number*: TRUCK-12',
      '*Skid Number*: SKID123',
      '*Driver Name:* Ada Driver',
      '*Driver Contact*: +2348012345678',
      '*Date Out*: 2026-11-21',
      '*Time Out*: 14:30',
    ].join('\n')
  );
});

test('matches incoming or outgoing notice text by truck and skid', () => {
  const text = '*Truck/Skid Dispatch Details*\n*Truck Number*: TRUCK-12\n*Skid Number*: SKID123';
  assert.equal(matchesDispatchNotification(text, details), true);
  assert.equal(matchesDispatchNotification(text, { ...details, skidNumber: 'SKID999' }), false);
  assert.equal(matchesDispatchNotification(text, { ...details, truckNumber: null }), false);
});
