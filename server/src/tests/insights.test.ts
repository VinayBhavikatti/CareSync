import test from 'node:test';
import assert from 'node:assert/strict';
import { adherenceCounts, hasMinimumSample, refillMath } from '../services/insightsMath.js';

const now = new Date('2026-11-15T12:00:00Z');
const dose = (status: 'TAKEN' | 'MISSED' | 'SKIPPED' | 'PENDING', at = '2026-11-14T12:00:00Z') => ({ status, scheduledAt: new Date(at) });

test('adherence formula handles no data, all taken, and all missed', () => {
  assert.equal(adherenceCounts([], now).adherencePercent, 100);
  assert.equal(adherenceCounts([dose('TAKEN'), dose('TAKEN')], now).adherencePercent, 100);
  assert.equal(adherenceCounts([dose('MISSED'), dose('MISSED')], now).adherencePercent, 0);
  assert.equal(adherenceCounts([dose('TAKEN', '2026-11-16T12:00:00Z')], now).total, 0);
});

test('patterns require at least five doses in each analyzed slice', () => {
  assert.equal(hasMinimumSample(4), false);
  assert.equal(hasMinimumSample(5), true);
});

test('refill math handles zero stock, multiple daily doses, and mid-range stock', () => {
  assert.deepEqual(refillMath(0, 1, 1), { dailyUsage: 1, daysRemaining: 0, status: 'CRITICAL' });
  assert.deepEqual(refillMath(12, 2, 3), { dailyUsage: 6, daysRemaining: 2, status: 'CRITICAL' });
  assert.deepEqual(refillMath(21, 1, 3), { dailyUsage: 3, daysRemaining: 7, status: 'OK' });
  assert.equal(refillMath(15, 1, 3).status, 'WARNING');
});
