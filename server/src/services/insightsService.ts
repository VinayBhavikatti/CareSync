import { PrismaClient, DoseStatus, MedicationStatus, EmailReminderType } from '@prisma/client';
import { getCurrentTime } from '../utils/clock.js';
import { sendEmailWithDeduplication } from './emailService.js';
import { adherenceCounts, hasMinimumSample, refillMath } from './insightsMath.js';
import { getReminderText } from '../notifications/translations.js';
import { decodeMedicationTimes } from '../utils/medicationTimes.js';
import { addLocalDays, localDateKey, localDayOfWeek, localHour, startOfLocalDayUtc } from '../utils/timezone.js';

const prisma = new PrismaClient();

export interface AdherenceStats {
  periodDays: number;
  overallAdherencePercent: number;
  totalPastDoses: number;
  totalTaken: number;
  totalMissed: number;
  totalSkipped: number;
  byMedicine: {
    medicationId: string;
    medicationName: string;
    dosage: string;
    adherencePercent: number;
    taken: number;
    missed: number;
    skipped: number;
    total: number;
  }[];
  dailyTrend: {
    date: string; // YYYY-MM-DD
    dayOfWeek: string;
    taken: number;
    missed: number;
    skipped: number;
    adherencePercent: number;
  }[];
}

export interface AdherencePattern {
  id: string;
  type: 'TIME_OF_DAY' | 'WEEKEND' | 'LATENESS';
  title: string;
  observation: string;
  sampleSize: number;
  metric: string;
  severity: 'low' | 'medium' | 'high';
}

export interface RefillPrediction {
  medicationId: string;
  medicationName: string;
  dosage: string;
  stockCount: number;
  pillsPerDose: number;
  dosesPerDay: number;
  dailyUsage: number;
  daysRemaining: number;
  estimatedRunOutDate: string;
  status: 'OK' | 'WARNING' | 'CRITICAL';
}

/**
 * Calculates adherence percentage and breakdown over the given number of days (e.g. 7 or 30).
 * Excludes future doses and incomplete pending doses.
 */
export async function calculateAdherence(profileId: string, days: number = 7, range?: { start: Date; end: Date }): Promise<AdherenceStats> {
  const now = getCurrentTime();
  const profile = await prisma.careProfile.findUnique({ where: { id: profileId }, select: { timezone: true } });
  const timeZone = profile?.timezone || 'Asia/Kolkata';
  const todayKey = localDateKey(now, timeZone);
  const startDate = startOfLocalDayUtc(addLocalDays(todayKey, -(days - 1)), timeZone);

  // Fetch past doses up to current time
  const doses = await prisma.doseLog.findMany({
    where: {
      profileId,
      scheduledAt: {
        gte: range?.start ?? startDate,
        lte: range?.end ?? now,
      },
      status: { in: [DoseStatus.TAKEN, DoseStatus.MISSED, DoseStatus.SKIPPED] },
    },
    include: { medication: true },
    orderBy: { scheduledAt: 'asc' },
  });

  const counts = adherenceCounts(doses, now);
  const { taken: totalTaken, missed: totalMissed, skipped: totalSkipped, total: totalPastDoses } = counts;
  const overallAdherencePercent = counts.adherencePercent;

  // Breakdown by medicine
  const medMap = new Map<string, { med: any; taken: number; missed: number; skipped: number }>();
  for (const d of doses) {
    const entry = medMap.get(d.medicationId) || {
      med: d.medication,
      taken: 0,
      missed: 0,
      skipped: 0,
    };
    if (d.status === DoseStatus.TAKEN) entry.taken++;
    else if (d.status === DoseStatus.MISSED) entry.missed++;
    else if (d.status === DoseStatus.SKIPPED) entry.skipped++;
    medMap.set(d.medicationId, entry);
  }

  const byMedicine = Array.from(medMap.values()).map(({ med, taken, missed, skipped }) => {
    const total = taken + missed + skipped;
    const adherencePercent = total > 0 ? Math.round((taken / total) * 1000) / 10 : 100;
    return {
      medicationId: med.id,
      medicationName: med.name,
      dosage: med.dosage,
      adherencePercent,
      taken,
      missed,
      skipped,
      total,
    };
  });

  // Daily trend
  const dailyMap = new Map<string, { date: string; taken: number; missed: number; skipped: number }>();

  // Initialize every day in range
  for (let i = days - 1; i >= 0; i--) {
    const dateKey = addLocalDays(todayKey, -i);
    dailyMap.set(dateKey, { date: dateKey, taken: 0, missed: 0, skipped: 0 });
  }

  for (const d of doses) {
    const dateKey = localDateKey(d.scheduledAt, timeZone);
    const entry = dailyMap.get(dateKey) || { date: dateKey, taken: 0, missed: 0, skipped: 0 };
    if (d.status === DoseStatus.TAKEN) entry.taken++;
    else if (d.status === DoseStatus.MISSED) entry.missed++;
    else if (d.status === DoseStatus.SKIPPED) entry.skipped++;
    dailyMap.set(dateKey, entry);
  }

  const dailyTrend = Array.from(dailyMap.values()).map((entry) => {
    const dObj = new Date(entry.date + 'T00:00:00.000Z');
    const dayOfWeek = dObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const tot = entry.taken + entry.missed + entry.skipped;
    const adherencePercent = tot > 0 ? Math.round((entry.taken / tot) * 100) : 100;
    return {
      date: entry.date,
      dayOfWeek,
      taken: entry.taken,
      missed: entry.missed,
      skipped: entry.skipped,
      adherencePercent,
    };
  });

  return {
    periodDays: days,
    overallAdherencePercent,
    totalPastDoses,
    totalTaken,
    totalMissed,
    totalSkipped,
    byMedicine,
    dailyTrend,
  };
}

/**
 * Deterministically analyzes DoseLog data to discover simple, explainable patterns.
 * Requires minimum sample thresholds (>= 5 doses in the relevant slice).
 */
export async function detectAdherencePatterns(profileId: string, days: number = 30, range?: { start: Date; end: Date }): Promise<AdherencePattern[]> {
  const now = getCurrentTime();
  const profile = await prisma.careProfile.findUnique({ where: { id: profileId }, select: { timezone: true } });
  const timeZone = profile?.timezone || 'Asia/Kolkata';
  const todayKey = localDateKey(now, timeZone);
  const startDate = startOfLocalDayUtc(addLocalDays(todayKey, -(days - 1)), timeZone);

  const doses = await prisma.doseLog.findMany({
    where: {
      profileId,
      scheduledAt: { gte: range?.start ?? startDate, lte: range?.end ?? now },
      status: { in: [DoseStatus.TAKEN, DoseStatus.MISSED, DoseStatus.SKIPPED] },
    },
    include: { medication: true },
    orderBy: { scheduledAt: 'asc' },
  });

  const patterns: AdherencePattern[] = [];

  if (!hasMinimumSample(doses.length)) {
    return patterns; // Not enough total data
  }

  // ── 1. Weekend vs Weekday Pattern ──────────────────────────────────────────
  let weekendMissed = 0;
  let weekendTotal = 0;
  let weekdayMissed = 0;
  let weekdayTotal = 0;

  for (const d of doses) {
    const day = localDayOfWeek(d.scheduledAt, timeZone); // 0 is Sunday, 6 is Saturday
    const isWeekend = day === 0 || day === 6;
    const isMissed = d.status === DoseStatus.MISSED;

    if (isWeekend) {
      weekendTotal++;
      if (isMissed) weekendMissed++;
    } else {
      weekdayTotal++;
      if (isMissed) weekdayMissed++;
    }
  }

  // Requires at least 5 doses on weekends
  if (hasMinimumSample(weekendTotal) && hasMinimumSample(weekdayTotal)) {
    const weekendMissRate = weekendMissed / weekendTotal;
    const weekdayMissRate = weekdayMissed / weekdayTotal;

    if (weekendMissRate >= 0.3 && weekendMissRate >= weekdayMissRate + 0.15) {
      patterns.push({
        id: 'pattern-weekend-misses',
        type: 'WEEKEND',
        title: 'More doses missed on weekends',
        observation: `Missed ${weekendMissed} of ${weekendTotal} scheduled weekend doses (${Math.round(weekendMissRate * 100)}%), compared to ${weekdayMissed} of ${weekdayTotal} on weekdays (${Math.round(weekdayMissRate * 100)}%).`,
        sampleSize: weekendTotal,
        metric: `${Math.round(weekendMissRate * 100)}% weekend miss rate`,
        severity: weekendMissRate > 0.5 ? 'high' : 'medium',
      });
    }
  }

  // ── 2. Time of Day Pattern (Morning vs Afternoon vs Evening) ───────────────
  // Morning: 05:00 - 11:59
  // Afternoon: 12:00 - 16:59
  // Evening: 17:00 - 23:59
  const periods = {
    morning: { missed: 0, total: 0, label: 'morning (before 12 PM)' },
    afternoon: { missed: 0, total: 0, label: 'afternoon (12 PM - 5 PM)' },
    evening: { missed: 0, total: 0, label: 'evening (after 5 PM)' },
  };

  for (const d of doses) {
    const hour = localHour(d.scheduledAt, timeZone);
    const isMissed = d.status === DoseStatus.MISSED;

    let periodKey: 'morning' | 'afternoon' | 'evening';
    if (hour >= 5 && hour < 12) periodKey = 'morning';
    else if (hour >= 12 && hour < 17) periodKey = 'afternoon';
    else periodKey = 'evening';

    periods[periodKey].total++;
    if (isMissed) periods[periodKey].missed++;
  }

  for (const [key, p] of Object.entries(periods) as ['morning' | 'afternoon' | 'evening', any][]) {
    if (hasMinimumSample(p.total)) {
      const missRate = p.missed / p.total;
      // Calculate average miss rate of other periods
      const otherPeriods = Object.entries(periods).filter(([k]) => k !== key);
      const otherMissed = otherPeriods.reduce((acc, [, val]) => acc + val.missed, 0);
      const otherTotal = otherPeriods.reduce((acc, [, val]) => acc + val.total, 0);
      const otherMissRate = otherTotal > 0 ? otherMissed / otherTotal : 0;

      if (missRate >= 0.35 && missRate >= otherMissRate + 0.15) {
        patterns.push({
          id: `pattern-time-of-day-${key}`,
          type: 'TIME_OF_DAY',
          title: `Misses ${key} doses most frequently`,
          observation: `Missed ${p.missed} of ${p.total} ${p.label} doses (${Math.round(missRate * 100)}% miss rate), significantly higher than other times of day.`,
          sampleSize: p.total,
          metric: `${Math.round(missRate * 100)}% miss rate in ${key}`,
          severity: missRate > 0.5 ? 'high' : 'medium',
        });
      }
    }
  }

  // ── 3. Lateness Pattern (Doses taken 20+ minutes late) ─────────────────────
  let lateTakenCount = 0;
  let onTimeTakenCount = 0;

  for (const d of doses) {
    if (d.status === DoseStatus.TAKEN && d.loggedAt) {
      const delayMinutes = (d.loggedAt.getTime() - d.scheduledAt.getTime()) / (60 * 1000);
      if (delayMinutes >= 20) {
        lateTakenCount++;
      } else {
        onTimeTakenCount++;
      }
    }
  }

  const totalTakenAnalyzed = lateTakenCount + onTimeTakenCount;
  if (hasMinimumSample(totalTakenAnalyzed) && lateTakenCount / totalTakenAnalyzed >= 0.4) {
    const latePercent = Math.round((lateTakenCount / totalTakenAnalyzed) * 100);
    patterns.push({
      id: 'pattern-lateness-taken',
      type: 'LATENESS',
      title: 'Frequently logs medication 20+ minutes late',
      observation: `Took ${lateTakenCount} of ${totalTakenAnalyzed} recorded doses more than 20 minutes after the scheduled time (${latePercent}%).`,
      sampleSize: totalTakenAnalyzed,
      metric: `${latePercent}% taken late`,
      severity: 'low',
    });
  }

  return patterns;
}

/**
 * Calculates days of supply left for all active medicines.
 * Alerts at 5 days or less (WARNING), and 2 days or less (CRITICAL).
 */
export async function calculateRefillPredictions(profileId: string): Promise<RefillPrediction[]> {
  const now = getCurrentTime();

  const medications = await prisma.medication.findMany({
    where: {
      profileId,
      status: MedicationStatus.ACTIVE,
    },
    orderBy: { stockCount: 'asc' },
  });
  const profile = await prisma.careProfile.findUnique({ where: { id: profileId }, select: { timezone: true } });
  const timeZone = profile?.timezone || 'Asia/Kolkata';

  return medications.map((med) => {
    const dosesPerDay = Math.max(1, decodeMedicationTimes(med.times).length);
    const { dailyUsage, daysRemaining, status } = refillMath(med.stockCount, med.pillsPerDose, dosesPerDay);

    const runOutDate = new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000);

    return {
      medicationId: med.id,
      medicationName: med.name,
      dosage: med.dosage,
      stockCount: med.stockCount,
      pillsPerDose: med.pillsPerDose,
      dosesPerDay,
      dailyUsage,
      daysRemaining,
      estimatedRunOutDate: runOutDate.toLocaleDateString('en-IN', {
        timeZone,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status,
    };
  });
}

/**
 * Scans active medicines for low stock (<= 5 days) and emails Elder + Caretaker.
 * Reuses deduplication logic: will not re-send for the same stock cycle until restocked.
 */
export async function checkAndSendRefillAlerts(profileId: string): Promise<void> {
  const profile = await prisma.careProfile.findUnique({
    where: { id: profileId },
  });

  if (!profile) return;

  const predictions = await calculateRefillPredictions(profileId);
  const lowStockMeds = predictions.filter((p) => p.status === 'WARNING' || p.status === 'CRITICAL');

  const recipients = [profile.elderEmail, profile.caretakerEmail].filter((e): e is string => Boolean(e));

  for (const item of lowStockMeds) {
    // Unique entityId key: combines med ID and the current stock count so an alert is sent
    // once per stock level, and won't trigger again until restocked and depleted again.
    const med = await prisma.medication.findUnique({ where: { id: item.medicationId }, select: { refillCycle: true } as any });
    const entityCycleId = `refill-${item.medicationId}-cycle-${(med as any)?.refillCycle ?? 0}`;
    const message = getReminderText('REFILL_WARNING', (profile as any).language, { name: profile.name, medicine: item.medicationName, dosage: item.dosage, stock: item.stockCount, days: item.daysRemaining });

    for (const email of recipients) {
      await sendEmailWithDeduplication({
        profileId,
        entityId: entityCycleId,
        entityType: 'Medication',
        reminderType: EmailReminderType.REFILL_WARNING,
        recipient: email,
        subject: `${item.status === 'CRITICAL' ? 'RED ALERT: ' : 'REFILL: '}${message.subject}`,
        body: message.body,
      });
    }
  }
}
