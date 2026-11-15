import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, FileText, Printer, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { insightsApi, type SummaryData } from '../api/insights';
import { aiApi } from '../api/ai';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { CardSkeleton } from '../components/Skeleton';
import { StatusChip } from '../components/StatusChip';
import { addDateKeyDays, formatInTimeZone, localDateKey } from '../utils/timezone';

export function SummaryPage() {
  const { user } = useAuth();
  const today = localDateKey(new Date(), user?.timezone);
  const [start, setStart] = useState(addDateKeyDays(today, -29));
  const [end, setEnd] = useState(today);
  const [data, setData] = useState<SummaryData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<{ text: string; generated: boolean } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setError(''); setLoading(true); setAiSummary(null);
    try { setData(await insightsApi.summary(user.token, start, end)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load the care summary.'); }
    finally { setLoading(false); }
  }, [user, start, end]);
  useEffect(() => { void load(); }, [load]);

  const generatePlainSummary = async () => {
    if (!user || !data) return;
    setAiLoading(true);
    const parsePair = (text: string) => { const match = text.match(/(?:missed|took)\s+(\d+)\s+of\s+(\d+)/i); return match ? { count: Number(match[1]), total: Number(match[2]) } : { count: 0, total: 0 }; };
    const input = {
      periodDays: data.adherence.periodDays, adherencePercent: data.adherence.overallAdherencePercent,
      taken: data.adherence.totalTaken, missed: data.adherence.totalMissed, skipped: data.adherence.totalSkipped,
      patterns: data.patterns.map((pattern) => ({ type: pattern.type as 'TIME_OF_DAY' | 'WEEKEND' | 'LATENESS', ...parsePair(pattern.observation) })),
      refills: data.refills.filter((refill) => refill.status !== 'OK').map((refill) => ({ status: refill.status as 'WARNING' | 'CRITICAL', daysRemaining: refill.daysRemaining })),
    };
    try { setAiSummary(await aiApi.adherenceSummary(user.token, input)); }
    catch { setAiSummary({ text: `For ${input.periodDays} days, recorded adherence was ${input.adherencePercent}%. ${input.taken} doses were taken, ${input.missed} missed, and ${input.skipped} skipped.`, generated: false }); }
    finally { setAiLoading(false); }
  };

  return <div className="summary-root flex flex-col gap-6">
    <PageHeader title="Care summary" description="A printable overview of dose records, observations, refills, and upcoming appointments." />
    <Card className="no-print">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-2 text-lg font-semibold">From <input aria-label="Summary start date" className="input-field" type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label>
        <label className="flex flex-col gap-2 text-lg font-semibold">To <input aria-label="Summary end date" className="input-field" type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
        <Button onClick={() => void load()} disabled={loading}>Update summary</Button>
        <Button variant="secondary" onClick={() => window.print()}><Printer size={20} aria-hidden="true" /> Print</Button>
      </div>
    </Card>
    {error && <div className="error-box flex flex-wrap items-center justify-between gap-3" role="alert"><span>{error}</span><Button variant="secondary" onClick={() => void load()}>Try again</Button></div>}
    {loading ? <div className="grid gap-4" role="status" aria-label="Loading care summary"><CardSkeleton /><CardSkeleton /></div> : !data ? <EmptyState title="No summary data for this range" description="Choose a date range with recorded care activity, then update the summary." icon={<FileText size={36} />} /> : <>
      <article className="flex flex-col gap-5">
        <div>
          <h2 className="text-3xl font-bold">CareSync care summary</h2>
          <p className="mt-1 text-lg text-muted">{data.profile?.name} · {start} to {end}</p>
        </div>
        <Card>
          <h3 className="text-2xl font-bold">Adherence at a glance</h3>
          <p className="mt-3 text-3xl font-bold">{data.adherence.overallAdherencePercent}%</p>
          <p className="mt-1 text-lg">{data.adherence.totalTaken} taken of {data.adherence.totalPastDoses} recorded doses</p>
          <div className="mt-3 flex flex-wrap gap-3 text-lg">
            <StatusChip status="TAKEN" label={`${data.adherence.totalTaken} taken`} />
            <StatusChip status="MISSED" label={`${data.adherence.totalMissed} missed`} />
            <StatusChip status="SKIPPED" label={`${data.adherence.totalSkipped} skipped`} />
          </div>
        </Card>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card><h3 className="text-2xl font-bold">By medicine</h3>{data.adherence.byMedicine.length ? <ul className="mt-3 space-y-2 text-lg">{data.adherence.byMedicine.map((medicine) => <li key={medicine.medicationId} className="border-b border-token pb-2"><strong>{medicine.medicationName} ({medicine.dosage}):</strong> {medicine.adherencePercent}% — {medicine.taken} taken, {medicine.missed} missed, {medicine.skipped} skipped</li>)}</ul> : <p className="mt-3 text-lg text-muted">No medication doses were recorded for this period.</p>}</Card>
          <Card><h3 className="text-2xl font-bold">Missed doses</h3>{data.missedDoses.length ? <ul className="mt-3 list-disc space-y-2 pl-6 text-lg">{data.missedDoses.map((dose) => <li key={dose.id}>{formatInTimeZone(dose.scheduledAt, user?.timezone, { dateStyle: 'medium', timeStyle: 'short' })} — {dose.medicationName} ({dose.dosage})</li>)}</ul> : <p className="mt-3 text-lg text-muted">No missed doses in this period.</p>}</Card>
          <Card><h3 className="text-2xl font-bold">Observed patterns</h3>{data.patterns.length ? <ul className="mt-3 list-disc space-y-2 pl-6 text-lg">{data.patterns.map((pattern) => <li key={pattern.id}>{pattern.observation}</li>)}</ul> : <p className="mt-3 text-lg text-muted">No patterns met the minimum sample size.</p>}</Card>
          <Card><h3 className="text-2xl font-bold">Refills needed</h3>{data.refills.filter((refill) => refill.status !== 'OK').length ? <ul className="mt-3 space-y-2 text-lg">{data.refills.filter((refill) => refill.status !== 'OK').map((refill) => <li key={refill.medicationId} className="flex items-center gap-3"><StatusChip status={refill.status === 'CRITICAL' ? 'MISSED' : 'DUE'} label={refill.status === 'CRITICAL' ? 'Refill needed' : 'Refill soon'} />{refill.medicationName}: about {refill.daysRemaining} days remaining</li>)}</ul> : <p className="mt-3 text-lg text-muted">No refill needs identified.</p>}</Card>
          <Card><h3 className="flex items-center gap-2 text-2xl font-bold"><CalendarDays aria-hidden="true" /> Upcoming appointments</h3>{data.upcomingAppointments.length ? <ul className="mt-3 list-disc space-y-2 pl-6 text-lg">{data.upcomingAppointments.map((appointment) => <li key={appointment.id}>{formatInTimeZone(appointment.scheduledAt, user?.timezone, { dateStyle: 'medium', timeStyle: 'short' })} — {appointment.title}{appointment.doctorName ? `, ${appointment.doctorName}` : ''}</li>)}</ul> : <p className="mt-3 text-lg text-muted">No upcoming appointments.</p>}</Card>
          <Card><h3 className="text-2xl font-bold">Questions for the doctor</h3><div className="mt-3 min-h-44 rounded-lg border-2 border-dashed border-slate-400 p-4 text-lg text-muted" aria-label="Blank space for questions for the doctor" /></Card>
        </div>
        <Card className="no-print">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-2xl font-bold"><Sparkles size={22} aria-hidden="true" /> Plain-language summary</h3><p className="mt-1 text-lg text-muted">Uses only the figures shown above. The exact records remain visible.</p></div><Button onClick={() => void generatePlainSummary()} disabled={aiLoading} isLoading={aiLoading}>Generate plain-language summary</Button></div>
        </Card>
        {aiSummary && <Card className="border-l-4 border-l-caresync-700"><h3 className="text-2xl font-bold">{aiSummary.generated ? 'AI-generated summary' : 'Plain-language summary'}</h3><p className="mt-2 text-lg leading-relaxed">{aiSummary.text}</p><p className="mt-2 text-lg font-semibold text-muted">Exact figures above are the source record; compare this summary with them.</p></Card>}
      </article>
    </>}
  </div>;
}
