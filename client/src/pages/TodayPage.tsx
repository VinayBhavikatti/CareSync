import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Bell, CalendarDays, Check, CheckCheck, Clock3, Info, MailCheck, PackageCheck, SkipForward, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dosesApi, type DoseItem, type DoseStatus } from '../api/doses';
import { emailLogsApi } from '../api/emailLogs';
import { appointmentsApi, type Appointment } from '../api/appointments';
import { insightsApi, type InsightsData, type Refill } from '../api/insights';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ProgressRing } from '../components/ProgressRing';
import { CardSkeleton } from '../components/Skeleton';
import { StatusChip, type StatusKind } from '../components/StatusChip';
import { SymbolRain } from '../components/SymbolRain';
import { formatDateKey, formatInTimeZone, localDateKey } from '../utils/timezone';

const dayParts = [
  { title: 'Morning', from: 5, to: 11 },
  { title: 'Afternoon', from: 12, to: 16 },
  { title: 'Evening', from: 17, to: 20 },
  { title: 'Night', from: 21, to: 28 },
];

function localHour(date: string, timezone?: string): number {
  const hour = Number(formatInTimeZone(date, timezone, { hour: '2-digit', hour12: false }));
  return hour === 0 ? 24 : hour;
}
function visibleStatus(dose: DoseItem, nowMs: number): DoseStatus {
  if (dose.status === 'PENDING' && nowMs - new Date(dose.scheduledAt).getTime() >= 30 * 60_000) return 'MISSED';
  return dose.status;
}
function statusKind(status: DoseStatus): StatusKind { return status === 'PENDING' ? 'DUE' : status; }
function splitDoseNotes(instructions?: string | null) {
  const text = instructions ?? '';
  const frequencyMatch = text.match(/frequency\s*:\s*([^\r\n]+)/i);
  const instruction = text.replace(/frequency\s*:\s*[^\r\n]+/i, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join(' ');
  return { instruction, frequency: frequencyMatch ? `Frequency: ${frequencyMatch[1].trim()}` : undefined };
}
function refillDays(refill: Refill): number { return Math.max(0, Math.floor(refill.daysRemaining)); }
function greeting(now: Date, timezone?: string) {
  const hour = Number(formatInTimeZone(now.toISOString(), timezone, { hour: '2-digit', hour12: false }));
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}
function countdown(target: string, nowMs: number) {
  const minutes = Math.max(0, Math.floor((new Date(target).getTime() - nowMs) / 60_000));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `in ${hours} h ${remainder} min` : `in ${remainder} min`;
}
function AnimatedProgressBar({ value }: { value: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return <div className="progress-bar-value h-full rounded-full bg-emerald-700 dark:bg-emerald-400" style={{ width: ready ? `${value}%` : '0%' }} />;
}

function WelcomeIllustration() {
  return <svg aria-hidden="true" viewBox="0 0 260 180" className="welcome-art hidden h-40 w-56 shrink-0 sm:block">
    <path d="M18 145h224" fill="none" stroke="currentColor" strokeOpacity=".18" strokeWidth="2" />
    <path d="M32 105h31l11-20 14 42 15-30 10 8h18" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="heartbeat-line" />
    <rect x="154" y="55" width="54" height="84" rx="12" fill="var(--surface)" stroke="currentColor" strokeOpacity=".35" strokeWidth="3" />
    <rect x="164" y="43" width="34" height="17" rx="5" fill="var(--primary)" opacity=".75" />
    <rect x="162" y="82" width="38" height="37" rx="7" fill="var(--surface-subtle)" />
    <path d="M181 91c-8-9-18 3 0 14 18-11 8-23 0-14Z" fill="#d46b78" />
    <g className="capsule-float capsule-one" transform="rotate(-28 116 64)"><rect x="94" y="54" width="45" height="20" rx="10" fill="#dbeeea" stroke="currentColor" strokeOpacity=".45" strokeWidth="2"/><path d="M116 55v18" stroke="currentColor" strokeOpacity=".35" strokeWidth="2"/><path d="M96 64a10 10 0 0 1 10-9h10v18h-10a10 10 0 0 1-10-9Z" fill="var(--primary)" opacity=".72"/></g>
    <g className="capsule-float capsule-two" transform="rotate(24 129 126)"><rect x="106" y="117" width="46" height="19" rx="10" fill="#f3dfbd" stroke="currentColor" strokeOpacity=".38" strokeWidth="2"/><path d="M129 118v17" stroke="currentColor" strokeOpacity=".3" strokeWidth="2"/><path d="M107 126.5a10 10 0 0 1 10-9.5h12v19h-12a10 10 0 0 1-10-9.5Z" fill="#d2a86c" opacity=".7"/></g>
  </svg>;
}

export function TodayPage() {
  const { user } = useAuth();
  const [doses, setDoses] = useState<DoseItem[]>([]);
  const [todayDate, setTodayDate] = useState(() => localDateKey(new Date(), user?.timezone));
  const [nowMs, setNowMs] = useState(Date.now());
  const [demoClock, setDemoClock] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [refills, setRefills] = useState<Refill[]>([]);
  const [week, setWeek] = useState<InsightsData['dailyTrend']>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'info' } | null>(null);
  const [recentlyTakenId, setRecentlyTakenId] = useState<string | null>(null);

  const fetchDoses = useCallback(async () => {
    if (!user) return;
    try {
      setError('');
      const data = await dosesApi.getToday(user.token);
      setDoses(data.doses);
      setTodayDate(data.date);
      let referenceTime = Date.now();
      try { const clock = await emailLogsApi.getClockStatus(); referenceTime = new Date(clock.virtualTime).getTime(); setDemoClock(clock.demoMode); } catch { /* The real clock remains the fallback. */ }
      setNowMs(referenceTime);
      const [appointmentResult, refillResult, adherenceResult] = await Promise.allSettled([
        appointmentsApi.getAll(user.token), insightsApi.refills(user.token), insightsApi.adherence(user.token, 7),
      ]);
      if (appointmentResult.status === 'fulfilled') setAppointments(appointmentResult.value.appointments);
      if (refillResult.status === 'fulfilled') setRefills(refillResult.value.refills);
      if (adherenceResult.status === 'fulfilled') setWeek(adherenceResult.value.dailyTrend);
      if (adherenceResult.status === 'fulfilled') {
        let run = 0;
        for (const day of [...adherenceResult.value.dailyTrend].reverse()) {
          if (day.taken === 0 || day.taken !== day.taken + day.missed + day.skipped) break;
          run++;
        }
        setStreak(run);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load today’s doses.');
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    void fetchDoses();
    const handler = () => { void fetchDoses(); };
    window.addEventListener('demo-clock-advanced', handler);
    return () => { window.removeEventListener('demo-clock-advanced', handler); };
  }, [fetchDoses]);

  useEffect(() => {
    if (demoClock) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [demoClock]);

  const handleUpdateStatus = async (id: string, newStatus: DoseStatus) => {
    if (!user) return;
    setActionLoadingId(id);
    try {
      const res = await dosesApi.updateStatus(user.token, id, newStatus);
      setDoses((prev) => prev.map((dose) => dose.id === id ? { ...dose, status: res.dose.status, loggedAt: res.dose.loggedAt } : dose));
      setNotification({ msg: newStatus === 'TAKEN' ? 'Nice, dose logged.' : res.message, type: newStatus === 'TAKEN' ? 'success' : 'info' });
      if (newStatus === 'TAKEN') {
        setRecentlyTakenId(id);
        window.setTimeout(() => setRecentlyTakenId((current) => current === id ? null : current), 1200);
      }
      window.setTimeout(() => setNotification(null), 4000);
      void fetchDoses();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to update this dose.'); }
    finally { setActionLoadingId(null); }
  };

  const canMarkDoses = user?.role === 'ELDER' || user?.role === 'CARETAKER';
  const withStatus = doses.map((dose) => ({ dose, status: visibleStatus(dose, nowMs) }));
  const totalCount = doses.length;
  const takenCount = withStatus.filter(({ status }) => status === 'TAKEN').length;
  const remainingCount = withStatus.filter(({ status }) => status === 'PENDING').length;
  const nextDose = withStatus.filter(({ status, dose }) => status === 'PENDING' && new Date(dose.scheduledAt).getTime() > nowMs).sort((a, b) => new Date(a.dose.scheduledAt).getTime() - new Date(b.dose.scheduledAt).getTime())[0];
  const upcomingAppointments = appointments.filter((appt) => appt.status === 'UPCOMING' && new Date(appt.scheduledAt).getTime() >= nowMs).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const nextAppointment = upcomingAppointments[0];
  const lowestRefill = [...refills].sort((a, b) => a.daysRemaining - b.daysRemaining)[0];
  const warningRefills = refills.filter((refill) => refill.status !== 'OK');
  const dateLabel = formatDateKey(todayDate, user?.timezone, { weekday: 'long', month: 'long', day: 'numeric' });

  return <div className="flex flex-col gap-6">
    <section className="card welcome-card symbol-rain-host today-enter flex items-center justify-between gap-4 overflow-hidden p-5 sm:p-7" aria-labelledby="welcome-title">
      <SymbolRain intensity="calm" />
      <div className="min-w-0">
        <p className="text-lg font-semibold text-muted">{dateLabel}</p>
        <h1 id="welcome-title" className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{greeting(new Date(nowMs), user?.timezone)}, {user?.elderName?.split(' ')[0] ?? 'there'}</h1>
        <p className="mt-2 text-lg leading-relaxed">{totalCount ? `You’ve taken ${takenCount} of ${totalCount} doses today.` : 'Your care plan is ready for today.'}</p>
      </div>
      <WelcomeIllustration />
    </section>

    {notification && <div className={`flex items-center gap-3 rounded-xl border p-4 text-lg font-semibold ${notification.type === 'success' ? 'success-box' : 'bg-sky-50 text-sky-950 dark:bg-sky-950 dark:text-sky-100'}`} role="status" aria-live="polite">
      {notification.type === 'success' ? <CheckCheck aria-hidden="true" /> : <Info aria-hidden="true" />}{notification.msg}
    </div>}
    {error && <div className="error-box flex flex-wrap items-center justify-between gap-3" role="alert"><span>{error}</span><Button variant="secondary" onClick={() => void fetchDoses()}>Try again</Button></div>}
    {user?.role === 'FAMILY' && <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 text-lg text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">This schedule is read-only for family members.</div>}

    <section className="grid gap-4 sm:grid-cols-3" aria-label="Care summary">
      <Link to="/insights" style={{ animationDelay: '40ms' }} className="card stat-card today-enter block transition-colors hover:border-caresync-500"><span className="text-lg text-muted">All-dose streak</span><strong className="mt-1 block text-2xl">{streak} {streak === 1 ? 'day' : 'days'}</strong><span className="mt-1 block text-lg">Days with every dose logged taken</span></Link>
      <Link to="/medicines" style={{ animationDelay: '80ms' }} className="card stat-card today-enter block transition-colors hover:border-caresync-500"><span className="text-lg text-muted">Refill status</span><strong className="mt-1 block text-2xl">{lowestRefill ? `${refillDays(lowestRefill)} days left` : 'Looking good'}</strong><span className="mt-1 block truncate text-lg">{lowestRefill?.medicationName ?? 'No active medicine data'}</span></Link>
      <Link to="/appointments" style={{ animationDelay: '120ms' }} className="card stat-card today-enter block transition-colors hover:border-caresync-500"><span className="text-lg text-muted">Next appointment</span><strong className="mt-1 block truncate text-2xl">{nextAppointment?.title ?? 'None scheduled'}</strong><span className="mt-1 block text-lg">{nextAppointment ? formatDateKey(nextAppointment.scheduledAt, user?.timezone, { month: 'short', day: 'numeric' }) : 'Add a visit to keep it handy'}</span></Link>
    </section>

    {loading ? <div className="grid gap-4" role="status" aria-label="Loading today’s schedule"><CardSkeleton /><CardSkeleton /></div> : <>
      {nextDose && <section className="card next-dose-card today-enter flex flex-col justify-between gap-4 border-caresync-300 bg-caresync-50 dark:border-caresync-800 dark:bg-caresync-950 sm:flex-row sm:items-center" aria-labelledby="next-dose-title">
        <div><p className="text-lg font-semibold text-caresync-800 dark:text-caresync-200">Next dose · {countdown(nextDose.dose.scheduledAt, nowMs)}</p><h2 id="next-dose-title" className="mt-1 text-2xl font-bold">{nextDose.dose.medication.name}</h2><p className="mt-1 text-lg">{nextDose.dose.medication.dosage} · {formatInTimeZone(nextDose.dose.scheduledAt, user?.timezone, { hour: 'numeric', minute: '2-digit', hour12: true })}</p></div>
        {canMarkDoses && <Button size="lg" disabled={actionLoadingId === nextDose.dose.id} isLoading={actionLoadingId === nextDose.dose.id} onClick={() => void handleUpdateStatus(nextDose.dose.id, 'TAKEN')}><Check size={21} aria-hidden="true" /> I took it</Button>}
      </section>}

      {totalCount === 0 && <EmptyState title="No doses scheduled today" description="Your active medicines will appear here when they have a dose scheduled for today." />}
      {totalCount > 0 && <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="card today-enter flex flex-wrap items-center gap-5" aria-label="Today’s dose progress">
            <ProgressRing value={takenCount / totalCount * 100} label="Taken" />
            <div className="min-w-48 flex-1"><h2 className="text-2xl font-bold">{takenCount} of {totalCount} doses taken</h2><p className="mt-1 text-lg text-muted">{remainingCount} still due{withStatus.some(({ status }) => status === 'MISSED') ? ` · ${withStatus.filter(({ status }) => status === 'MISSED').length} missed` : ''}</p><div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-label="Doses taken today" aria-valuemin={0} aria-valuemax={totalCount} aria-valuenow={takenCount}><AnimatedProgressBar value={takenCount / totalCount * 100} /></div></div>
          </section>
          {dayParts.map((part) => {
            const inPart = withStatus.filter(({ dose }) => { const hour = localHour(dose.scheduledAt, user?.timezone); return part.title === 'Night' ? hour >= 21 || hour <= 4 : hour >= part.from && hour <= part.to; });
            return <section key={part.title} aria-labelledby={`daypart-${part.title.toLowerCase()}`}><h2 id={`daypart-${part.title.toLowerCase()}`} className="mb-3 text-2xl font-bold">{part.title}</h2>
              {inPart.length === 0 ? <div className="flex items-center gap-3 rounded-2xl border border-dashed border-token surface-subtle px-4 py-4 text-lg text-muted"><svg aria-hidden="true" viewBox="0 0 40 40" className="h-10 w-10 shrink-0 text-caresync-800 dark:text-caresync-200"><rect x="11" y="6" width="18" height="28" rx="5" fill="none" stroke="currentColor" strokeWidth="2.5"/><path d="M15 6V3h10v3M15 16h10M15 21h7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M21 27c-4-4-8 2 0 6 8-4 4-10 0-6Z" fill="currentColor"/></svg><span>No doses planned for this part of the day.</span></div> : <div className="grid gap-3">{inPart.map(({ dose, status }, index) => {
                const busy = actionLoadingId === dose.id;
                return <article key={dose.id} style={{ animationDelay: `${index * 40}ms` }} className={`card dose-card today-enter flex flex-col justify-between gap-4 sm:flex-row sm:items-center ${status === 'PENDING' ? 'dose-due' : ''} ${recentlyTakenId === dose.id ? 'dose-logged' : ''}`}>
                  {recentlyTakenId === dose.id && <svg className="dose-check-draw" viewBox="0 0 32 32" aria-hidden="true"><path d="m6 17 6 6L26 9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  <div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 text-xl font-bold"><Clock3 size={21} aria-hidden="true" />{formatInTimeZone(dose.scheduledAt, user?.timezone, { hour: 'numeric', minute: '2-digit', hour12: true })}</span><StatusChip status={statusKind(status)} />
                    {dose.reminderTypesSent?.includes('DOSE_ESCALATION') && <StatusChip status="FAILED" label="Escalated to family" icon={<AlertTriangle size={18} aria-hidden="true" />} />}{!dose.reminderTypesSent?.includes('DOSE_ESCALATION') && dose.reminderTypesSent?.includes('DOSE_MISSED') && <StatusChip status="DUE" label="Missed alert sent" icon={<Bell size={18} aria-hidden="true" />} />}{dose.reminderTypesSent?.includes('DOSE_UPCOMING') && <StatusChip status="SIMULATED" label="Reminder sent" icon={<Bell size={18} aria-hidden="true" />} />}{dose.reminderTypesSent?.includes('DOSE_ALL_CLEAR') && <StatusChip status="TAKEN" label="All clear sent" icon={<MailCheck size={18} aria-hidden="true" />} />}</div>
                    <h3 className="text-2xl font-bold">{dose.medication.name} <span className="text-xl font-semibold text-caresync-800 dark:text-caresync-200">{dose.medication.dosage}</span></h3>{(() => { const notes = splitDoseNotes(dose.medication.instructions); return <>{notes.instruction && <p className="mt-1 text-lg text-muted">{notes.instruction}</p>}{notes.frequency && <p className="mt-1 text-base text-muted">{notes.frequency}</p>}</>; })()}<p className="mt-2 inline-flex items-center gap-2 text-lg text-muted"><PackageCheck size={20} aria-hidden="true" /> Stock remaining: <strong>{dose.medication.stockCount} pills</strong></p>
                  </div>
                  {canMarkDoses && <div className="flex flex-wrap gap-2 sm:shrink-0">{status !== 'TAKEN' ? <Button size="lg" disabled={busy} isLoading={busy} aria-label={`Mark ${dose.medication.name} dose taken`} onClick={() => void handleUpdateStatus(dose.id, 'TAKEN')}><Check size={21} aria-hidden="true" />{status === 'MISSED' || status === 'SKIPPED' ? 'Mark as taken' : 'I took it'}</Button> : <Button variant="secondary" size="lg" disabled={busy} onClick={() => void handleUpdateStatus(dose.id, 'PENDING')}>Undo</Button>}{status !== 'TAKEN' && status !== 'SKIPPED' && <Button variant="secondary" size="lg" disabled={busy} aria-label={`Skip ${dose.medication.name} dose`} onClick={() => void handleUpdateStatus(dose.id, 'SKIPPED')}><SkipForward size={20} aria-hidden="true" /> Skip</Button>}</div>}
                </article>;
              })}</div>}
            </section>;
          })}
        </div>

        <aside className="flex flex-col gap-4" aria-label="Care details">
          <section style={{ animationDelay: '160ms' }} className="card today-enter"><div className="mb-3 flex items-center gap-2"><CalendarDays size={22} aria-hidden="true"/><h2 className="text-2xl font-bold">Next appointment</h2></div>{nextAppointment ? <><p className="text-xl font-semibold">{nextAppointment.title}</p><p className="mt-1 text-lg text-muted">{nextAppointment.doctorName || 'Care visit'}</p><p className="mt-1 text-lg">{formatDateKey(nextAppointment.scheduledAt, user?.timezone, { weekday: 'long', month: 'long', day: 'numeric' })} · {formatInTimeZone(nextAppointment.scheduledAt, user?.timezone, { hour: 'numeric', minute: '2-digit', hour12: true })}</p></> : <p className="text-lg text-muted">No upcoming visits. Add an appointment when one is planned.</p>}<Link className="mt-3 inline-flex min-h-12 items-center font-semibold text-caresync-800 underline dark:text-caresync-200" to="/appointments">View appointments</Link></section>
          <section style={{ animationDelay: '200ms' }} className="card today-enter"><div className="mb-3 flex items-center gap-2"><PackageCheck size={22} aria-hidden="true"/><h2 className="text-2xl font-bold">Refill alerts</h2></div>{warningRefills.length ? <ul className="space-y-3">{warningRefills.slice(0, 4).map((refill) => <li key={refill.medicationId} className={`rounded-xl border p-3 text-lg ${refill.status === 'CRITICAL' ? 'border-rose-600 bg-rose-50 text-rose-950 dark:bg-rose-950 dark:text-rose-100' : 'border-amber-600 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100'}`}><strong>{refill.status === 'CRITICAL' ? 'Refill needed' : 'Refill soon'}</strong><br/>{refill.medicationName}: about {refillDays(refill)} days left</li>)}</ul> : <p className="text-lg text-muted">Your medicines have enough supply for now.</p>}<Link className="mt-3 inline-flex min-h-12 items-center font-semibold text-caresync-800 underline dark:text-caresync-200" to="/medicines">View medicines</Link></section>
          <section style={{ animationDelay: '240ms' }} className="card today-enter"><div className="mb-3 flex items-center gap-2"><TrendingUp size={22} aria-hidden="true"/><h2 className="text-2xl font-bold">Last 7 days</h2></div>{week.length ? <><div className="flex h-24 items-end gap-2" role="img" aria-label={`Seven day adherence: ${week.map((d) => `${d.dayOfWeek} ${d.adherencePercent}%`).join(', ')}`}>
            {week.map((day) => <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"><span className="text-base font-semibold">{day.adherencePercent}%</span><div className="w-full rounded-t-md bg-caresync-700 dark:bg-caresync-300" style={{ height: `${Math.max(8, day.adherencePercent)}%` }} /><span className="text-base text-muted">{day.dayOfWeek.slice(0, 2)}</span></div>)}
          </div><p className="mt-2 text-lg text-muted">Daily adherence across scheduled doses</p></> : <p className="text-lg text-muted">Dose history will build here as doses are logged.</p>}<Link className="mt-2 inline-flex min-h-12 items-center font-semibold text-caresync-800 underline dark:text-caresync-200" to="/insights">Open insights</Link></section>
        </aside>
      </div>}
    </>}
  </div>;
}
