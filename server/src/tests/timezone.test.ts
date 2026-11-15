import test from 'node:test';
import assert from 'node:assert/strict';
import { endOfLocalDayUtc, formatLocalDateTime, formatLocalTime, localDateKey, localDateTimeToUtc, startOfLocalDayUtc } from '../utils/timezone.js';

test('Asia/Kolkata local dose times convert to UTC instants for MySQL DATETIME', () => {
  assert.equal(localDateTimeToUtc('2026-11-15', '08:00', 'Asia/Kolkata').toISOString(), '2026-11-15T02:30:00.000Z');
  assert.equal(localDateTimeToUtc('2026-11-15', '20:00', 'Asia/Kolkata').toISOString(), '2026-11-15T14:30:00.000Z');
});

test('Asia/Kolkata day bounds span local midnight through the next midnight', () => {
  const start = startOfLocalDayUtc('2026-11-15', 'Asia/Kolkata');
  const end = endOfLocalDayUtc('2026-11-15', 'Asia/Kolkata');
  assert.equal(start.toISOString(), '2026-11-14T18:30:00.000Z');
  assert.equal(end.toISOString(), '2026-11-15T18:29:59.999Z');
  assert.equal(localDateKey(new Date('2026-11-15T02:30:00Z'), 'Asia/Kolkata'), '2026-11-15');
});

test('reminder time formatting uses the care profile timezone', () => {
  const utcInstant = new Date('2026-11-15T02:30:00.000Z');
  assert.equal(formatLocalTime(utcInstant, 'Asia/Kolkata'), '08:00 am');
  assert.match(formatLocalDateTime(utcInstant, 'Asia/Kolkata'), /15\/11\/2026, 8:00:00 am|15 Nov 2026, 8:00 am/i);
});
