import { env } from '../config/env.js';

let offsetMilliseconds = 0;

/**
 * Returns current date/time, shifted by the virtual demo offset if DEMO_MODE is true.
 */
export function getCurrentTime(): Date {
  if (!env.DEMO_MODE) {
    return new Date();
  }
  return new Date(Date.now() + offsetMilliseconds);
}

/**
 * Advance virtual time forward by N minutes.
 */
export function advanceVirtualClock(minutes: number): Date {
  if (!env.DEMO_MODE) {
    throw new Error('Demo mode is not enabled.');
  }
  offsetMilliseconds += minutes * 60 * 1000;
  return getCurrentTime();
}

/**
 * Reset virtual time offset back to real time.
 */
export function resetVirtualClock(): Date {
  offsetMilliseconds = 0;
  return getCurrentTime();
}

/**
 * Get current clock status.
 */
export function getClockStatus() {
  const realTime = new Date();
  const effectiveTime = getCurrentTime();
  return {
    realTime: realTime.toISOString(),
    virtualTime: effectiveTime.toISOString(),
    offsetMinutes: Math.round(offsetMilliseconds / (60 * 1000)),
    demoMode: env.DEMO_MODE,
  };
}

