export type DoseSample = { status: 'TAKEN' | 'MISSED' | 'SKIPPED' | 'PENDING'; scheduledAt: Date; loggedAt?: Date | null };

export function adherenceCounts(doses: DoseSample[], now = new Date()) {
  const eligible = doses.filter((dose) => dose.scheduledAt <= now && dose.status !== 'PENDING');
  const taken = eligible.filter((dose) => dose.status === 'TAKEN').length;
  const missed = eligible.filter((dose) => dose.status === 'MISSED').length;
  const skipped = eligible.filter((dose) => dose.status === 'SKIPPED').length;
  const total = taken + missed + skipped;
  return { taken, missed, skipped, total, adherencePercent: total ? Math.round((taken / total) * 1000) / 10 : 100 };
}

export function refillMath(stockCount: number, pillsPerDose: number, dosesPerDay: number) {
  const dailyUsage = Math.max(1, pillsPerDose) * Math.max(1, dosesPerDay);
  const daysRemaining = Math.floor(Math.max(0, stockCount) / dailyUsage);
  return { dailyUsage, daysRemaining, status: daysRemaining <= 2 ? 'CRITICAL' as const : daysRemaining <= 5 ? 'WARNING' as const : 'OK' as const };
}

export function hasMinimumSample(sampleSize: number) { return sampleSize >= 5; }
