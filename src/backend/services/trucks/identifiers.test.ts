import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveTruckSlugNumber } from './identifiers';

test('derives the slug number from a full truck plate', () => {
  assert.equal(deriveTruckSlugNumber('T-27735LA'), '27735');
});

test('keeps an existing numeric identifier and leaves plates without digits unassigned', () => {
  assert.equal(deriveTruckSlugNumber('27735'), '27735');
  assert.equal(deriveTruckSlugNumber('TRUCK-LA'), null);
});
