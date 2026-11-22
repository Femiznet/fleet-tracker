import assert from 'node:assert/strict';
import test from 'node:test';
import { plantDisplayNumber } from './identifiers';

test('uses the last two slug digits for plant truck numbers', () => {
  assert.equal(plantDisplayNumber('27735', 'T-27735LA', 2), '35');
});

test('uses the last four slug digits for plant skid numbers', () => {
  assert.equal(plantDisplayNumber('123456', 'SKID-123456', 4), '3456');
});

test('falls back to the full number when no slug digits are available', () => {
  assert.equal(plantDisplayNumber(null, 'T-27735LA', 2), 'T-27735LA');
});
