import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeMedicationTimes, encodeMedicationTimes } from '../utils/medicationTimes.js';

test('medication schedule JSON encoding preserves validated HH:mm times', () => {
  const times = ['08:00', '20:00'];
  assert.deepEqual(decodeMedicationTimes(encodeMedicationTimes(times)), times);
});

test('medication schedule JSON decoding rejects corrupt stored values', () => {
  assert.throws(() => decodeMedicationTimes(['8am']));
  assert.throws(() => decodeMedicationTimes({ morning: '08:00' }));
});
