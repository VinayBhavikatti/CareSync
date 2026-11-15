import { Prisma } from '@prisma/client';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Encode the public HH:mm list into Prisma's JSON input representation. */
export function encodeMedicationTimes(times: readonly string[]): Prisma.InputJsonValue {
  if (!times.length || !times.every((time) => HH_MM.test(time))) {
    throw new Error('Medication times must contain valid 24-hour HH:mm values.');
  }
  return [...times];
}

/** Decode and validate a JSON column before using it in schedules or API responses. */
export function decodeMedicationTimes(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || !value.every((time): time is string => typeof time === 'string' && HH_MM.test(time))) {
    throw new Error('Stored medication times are invalid.');
  }
  return [...value];
}
