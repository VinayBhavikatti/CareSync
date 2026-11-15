import { useCallback, useEffect, useState } from 'react';
import { ChartNoAxesCombined, FileText, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { insightsApi, type InsightsData, type Pattern, type Refill } from '../api/insights';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { CardSkeleton } from '../components/Skeleton';
import { StatusChip } from '../components/StatusChip';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function InsightsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<InsightsData | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [refills, setRefills] = useState<Refill[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      const [adherence, patternResult, refillResult] = await Promise.all([
        insightsApi.adherence(user.token, 7), insightsApi.patterns(user.token), insightsApi.refills(user.token),
      ]);
      setData(adherence); setPatterns(patternResult.patterns); setRefills(refillResult.refills);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load insights. Please try again.'); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { void load(); }, [load]);
  const chart = data?.dailyTrend ?? [];

  return <div className="flex flex-col gap-6">
    <PageHeader title="Insights" description="A clear view of dose records and refill needs over the last seven days." action={<Link className="btn-secondary inline-flex items-center gap-2 no-print" to="/summary"><FileText size={20} aria-hidden="true" /> Print care summary</Link>} />
    <section className="card page-hero" aria-label="Insights overview"><h2 className="text-2xl font-bold">Small steps add up</h2><p className="mt-1 text-lg text-muted">These records help your care circle see how the routine is going.</p><div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-xl surface-subtle p-4"><span className="text-lg text-muted">7-day adherence</span><strong className="mt-1 block text-2xl">{data ? `${data.overallAdherencePercent}%` : loading ? 'Loading' : 'No data yet'}</strong></div><div className="rounded-xl surface-subtle p-4"><span className="text-lg text-muted">Doses recorded</span><strong className="mt-1 block text-2xl">{data?.totalPastDoses ?? (loading ? 'Loading' : 0)}</strong></div><div className="rounded-xl surface-subtle p-4"><span className="text-lg text-muted">Refill reminders</span><strong className="mt-1 block text-2xl">{refills.filter((item) => item.status !== 'OK').length}</strong></div></div></section>
    {error && <div className="error-box flex flex-wrap items-center justify-between gap-3" role="alert"><span>{error}</span><Button variant="secondary" onClick={() => void load()}>Try again</Button></div>}
    {loading ? <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Loading insights"><CardSkeleton /><CardSkeleton /></div> : !data ? <EmptyState title="No insight data yet" description="Dose records will appear here once medicines have been scheduled." icon={<ChartNoAxesCombined size={36} />} /> : <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <Card>
          <div className="flex items-center gap-3"><TrendingUp className="text-caresync-800 dark:text-caresync-200" size={24} aria-hidden="true" /><h2 className="text-2xl font-bold">Overall adherence</h2></div>
          <p className="mt-3 text-5xl font-bold tracking-tight">{data.overallAdherencePercent}%</p>
          <p className="mt-2 text-lg text-muted">{data.totalTaken} taken of {data.totalPastDoses} recorded past doses.</p>
        </Card>
        <Card className="min-w-56"><p className="text-lg font-semibold text-muted">Missed doses</p><p className="mt-2 text-4xl font-bold text-rose-800 dark:text-rose-200">{data.totalMissed}</p><p className="mt-1 text-lg text-muted">in the last 7 days</p></Card>
      </div>
      <Card>
        <h2 className="mb-4 text-2xl font-bold">Daily dose records</h2>
        {chart.length === 0 ? <p className="text-lg text-muted">No daily dose data is available yet.</p> : <>
          <div role="img" aria-label="Stacked bar chart showing daily taken, missed, and skipped doses" className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} accessibilityLayer margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="date" tickFormatter={(date: string) => date.slice(5)} tick={{ fontSize: 18, fill: 'var(--ink)' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 18, fill: 'var(--ink)' }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--line)', fontSize: 18 }} />
                <Legend wrapperStyle={{ fontSize: 18 }} />
                <Bar dataKey="taken" name="Taken" stackId="doses" fill="#047857" />
                <Bar dataKey="missed" name="Missed" stackId="doses" fill="#be123c" />
                <Bar dataKey="skipped" name="Skipped" stackId="doses" fill="#475569" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <h3 className="mt-3 text-xl font-bold">Text alternative</h3>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-lg">{chart.map((day) => <li key={day.date}>{day.date}: {day.taken} taken, {day.missed} missed, {day.skipped} skipped ({day.adherencePercent}% adherence)</li>)}</ul>
        </>}
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card><h2 className="text-2xl font-bold">By medicine</h2>{data.byMedicine.length ? <ul className="mt-3 space-y-2 text-lg">{data.byMedicine.map((medicine) => <li key={medicine.medicationId} className="flex flex-wrap justify-between gap-2 border-b border-token pb-2"><span>{medicine.medicationName}</span><strong>{medicine.adherencePercent}% ({medicine.taken}/{medicine.total} taken)</strong></li>)}</ul> : <p className="mt-3 text-lg text-muted">No medicine doses were recorded in this period.</p>}</Card>
        <Card><h2 className="text-2xl font-bold">Observed patterns</h2>{patterns.length ? <ul className="mt-3 space-y-3 text-lg">{patterns.map((pattern) => <li key={pattern.id} className="border-l-4 border-caresync-700 pl-3"><strong>{pattern.title}.</strong> {pattern.observation}</li>)}</ul> : <p className="mt-3 text-lg text-muted">No patterns met the minimum sample size yet.</p>}</Card>
      </div>
      <Card><h2 className="text-2xl font-bold">Refill status</h2>{refills.filter((refill) => refill.status !== 'OK').length ? <ul className="mt-3 space-y-2 text-lg">{refills.filter((refill) => refill.status !== 'OK').map((refill) => <li key={refill.medicationId} className="flex flex-wrap items-center gap-3"><StatusChip status={refill.status === 'CRITICAL' ? 'MISSED' : 'DUE'} label={refill.status === 'CRITICAL' ? 'Refill needed' : 'Refill soon'} /> <span>{refill.medicationName}, about {refill.daysRemaining} days left.</span></li>)}</ul> : <p className="mt-3 text-lg text-muted">No refills needed soon.</p>}</Card>
    </>}
  </div>;
}
