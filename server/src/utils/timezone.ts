export function localDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function addLocalDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** Convert a profile-local wall time into the UTC instant stored by Prisma/MySQL. */
export function localDateTimeToUtc(dateKey: string, time: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wanted;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(instant));
    const value = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
    const represented = Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second);
    const next = wanted - (represented - instant);
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant);
}

export function startOfLocalDayUtc(dateKey: string, timeZone: string): Date {
  return localDateTimeToUtc(dateKey, '00:00', timeZone);
}

export function endOfLocalDayUtc(dateKey: string, timeZone: string): Date {
  return new Date(startOfLocalDayUtc(addLocalDays(dateKey, 1), timeZone).getTime() - 1);
}

export function localHour(date: Date, timeZone: string): number {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', hourCycle: 'h23',
  }).format(date));
}

export function localDayOfWeek(date: Date, timeZone: string): number {
  const key = localDateKey(date, timeZone);
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function formatLocalTime(date: Date, timeZone: string): string {
  return date.toLocaleTimeString('en-IN', { timeZone, hour: '2-digit', minute: '2-digit' });
}

export function formatLocalDateTime(date: Date, timeZone: string): string {
  return date.toLocaleString('en-IN', { timeZone, dateStyle: 'medium', timeStyle: 'short' });
}
