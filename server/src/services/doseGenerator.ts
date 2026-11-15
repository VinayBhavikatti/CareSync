import { PrismaClient, DoseStatus, MedicationStatus } from '@prisma/client';

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
  const dateStr = referenceTime.toLocaleDateString('en-CA', { timeZone: tz });

  // Define start and end of "today" in local time mapped to UTC
  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

  // 1. Fetch active medications for this profile
  const medications = await prisma.medication.findMany({
    where: {
      profileId,
      status: MedicationStatus.ACTIVE,
    },
  });

  // 2. For each medication and scheduled time, ensure DoseLog exists
  for (const med of medications) {
    for (const timeStr of med.times) {
      const scheduledDateTime = new Date(`${dateStr}T${timeStr}:00.000Z`);

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
  return prisma.doseLog.findMany({
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
        },
      },
    },
    orderBy: {
      scheduledAt: 'asc',
    },
  });
}

