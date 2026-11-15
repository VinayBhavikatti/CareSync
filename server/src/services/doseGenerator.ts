import { PrismaClient, DoseStatus, MedicationStatus } from '@prisma/client';
import { decodeMedicationTimes } from '../utils/medicationTimes.js';
import { endOfLocalDayUtc, localDateKey, localDateTimeToUtc, startOfLocalDayUtc } from '../utils/timezone.js';

const prisma = new PrismaClient();

/**
 * Ensures DoseLog rows exist for today's active medicines in the given profile's timezone.
 * Returns all doses for the day, sorted chronologically.
 */
export async function ensureTodayDosesForProfile(profileId: string, referenceTime: Date = new Date()) {
  const profile = await prisma.careProfile.findUnique({
    where: { id: profileId },
    select: { timezone: true },
  });

  const tz = profile?.timezone || 'Asia/Kolkata';

  // Format today's date in user's timezone (YYYY-MM-DD)
  const dateStr = localDateKey(referenceTime, tz);

  // Prisma/MySQL DATETIME stores UTC instants without timezone metadata.
  const startOfDay = startOfLocalDayUtc(dateStr, tz);
  const endOfDay = endOfLocalDayUtc(dateStr, tz);

  // 1. Fetch active medications for this profile
  const medications = await prisma.medication.findMany({
    where: {
      profileId,
      status: MedicationStatus.ACTIVE,
    },
  });

  // 2. For each medication and scheduled time, ensure DoseLog exists
  for (const med of medications) {
    for (const timeStr of decodeMedicationTimes(med.times)) {
      const scheduledDateTime = localDateTimeToUtc(dateStr, timeStr, tz);

      const existing = await prisma.doseLog.findFirst({
        where: {
          medicationId: med.id,
          profileId,
          scheduledAt: scheduledDateTime,
        },
      });

      if (!existing) {
        await prisma.doseLog.create({
          data: {
            medicationId: med.id,
            profileId,
            scheduledAt: scheduledDateTime,
            status: DoseStatus.PENDING,
          },
        });
      }
    }
  }

  // 3. Return all doses for today
  const doses = await prisma.doseLog.findMany({
    where: {
      profileId,
      scheduledAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: {
      medication: {
        select: {
          id: true,
          name: true,
          dosage: true,
          instructions: true,
          stockCount: true,
          pillsPerDose: true,
          times: true,
        },
      },
    },
    orderBy: {
      scheduledAt: 'asc',
    },
  });
  return doses.map((dose) => ({
    ...dose,
    medication: { ...dose.medication, times: decodeMedicationTimes(dose.medication.times) },
  }));
}

