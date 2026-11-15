export function formatInTimeZone(iso: string | Date, timeZone = 'Asia/Kolkata', options: Intl.DateTimeFormatOptions = {}): string {
  return new Date(iso).toLocaleString('en-IN', { timeZone, ...options });
}

export function localDateKey(date: Date, timeZone = 'Asia/Kolkata'): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addDateKeyDays(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`;
}

export function localTimeInput(iso: string, timeZone = 'Asia/Kolkata'): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.hour}:${values.minute}`;
}

export function localDateInput(iso: string, timeZone = 'Asia/Kolkata'): string {
  return localDateKey(new Date(iso), timeZone);
}

export function formatDateKey(key: string, timeZone = 'Asia/Kolkata', options: Intl.DateTimeFormatOptions = {}): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString('en-IN', { timeZone, ...options });
}

export function localDateTimeToIso(date: string, time: string, timeZone = 'Asia/Kolkata'): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wanted;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(instant));
    const value = Object.fromEntries(parts.map(part => [part.type, Number(part.value)]));
    const represented = Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second);
    const next = wanted - (represented - instant);
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant).toISOString();
}
