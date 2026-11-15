import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Bell, CalendarDays, CheckCheck, Clock3, Mail, PackageCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { emailLogsApi, type EmailLogItem, type EmailReminderType } from '../api/emailLogs';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { CardSkeleton } from '../components/Skeleton';
import { StatusChip, type StatusKind } from '../components/StatusChip';
import { formatInTimeZone } from '../utils/timezone';

const reminderLabels: Record<EmailReminderType, { label: string; Icon: typeof Mail }> = {
  DOSE_UPCOMING: { label: 'Upcoming dose reminder', Icon: Clock3 },
  DOSE_MISSED: { label: 'Missed dose alert', Icon: AlertTriangle },
  DOSE_ESCALATION: { label: 'Escalation', Icon: Bell },
  DOSE_ALL_CLEAR: { label: 'All clear', Icon: CheckCheck },
  APPOINTMENT_DAY_BEFORE: { label: 'Appointment reminder', Icon: CalendarDays },
  APPOINTMENT_TWO_HOUR: { label: 'Appointment reminder', Icon: CalendarDays },
  PROPOSAL_NEEDS_APPROVAL: { label: 'Approval needed', Icon: ShieldCheck },
  REFILL_WARNING: { label: 'Refill warning', Icon: PackageCheck },
};

export function EmailLogPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<EmailLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fetchLogs = useCallback(async () => {
    if (!user) return;
    try { setError(''); const data = await emailLogsApi.getAll(user.token, 1, 100); setLogs(data.logs); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load email history.'); }
    finally { setLoading(false); }
  }, [user]);
  useEffect(() => {
    void fetchLogs();
    const handler = () => { void fetchLogs(); };
    window.addEventListener('demo-clock-advanced', handler);
    return () => window.removeEventListener('demo-clock-advanced', handler);
  }, [fetchLogs]);

  return <div className="flex flex-col gap-6">
    <PageHeader title="Email log" description="A history of reminders, alerts, and escalation messages." action={<Button variant="secondary" onClick={() => { setLoading(true); void fetchLogs(); }}><RefreshCw size={20} aria-hidden="true" /> Refresh</Button>} />
    {error && <div className="error-box flex flex-wrap items-center justify-between gap-3" role="alert"><span>{error}</span><Button variant="secondary" onClick={() => void fetchLogs()}>Try again</Button></div>}
    {loading ? <div className="grid gap-4" role="status" aria-label="Loading email history"><CardSkeleton /><CardSkeleton /></div> : error && logs.length === 0 ? <EmptyState title="Email history could not be loaded" description="Check your connection, then try again." action={<Button onClick={() => void fetchLogs()}>Try again</Button>} /> : logs.length === 0 ? <EmptyState title="No email records yet" description="Reminder messages and delivery results will be listed here." icon={<Mail size={36} />} /> : <div className="grid gap-4">
      {logs.map((log) => {
        const reminder = reminderLabels[log.reminderType];
        const ReminderIcon = reminder.Icon;
        const expanded = expandedId === log.id;
        const status: StatusKind = log.status === 'SENT' ? 'SENT' : log.status === 'SIMULATED' ? 'SIMULATED' : 'FAILED';
        return <Card key={log.id}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2"><StatusChip status={status} /><span className="inline-flex items-center gap-2 rounded-full border border-token px-3 py-1 text-lg font-semibold"><ReminderIcon size={19} aria-hidden="true" />{reminder.label}</span></div>
              <h2 className="break-words text-2xl font-bold">{log.subject}</h2>
              <p className="mt-2 break-all text-lg"><strong>Recipient:</strong> <span className="text-caresync-900 dark:text-caresync-100">{log.recipient}</span></p>
              {log.error && <p className="mt-2 text-lg text-rose-800 dark:text-rose-200">Delivery error: {log.error}</p>}
            </div>
            <p className="shrink-0 text-lg text-muted sm:text-right">{formatInTimeZone(log.sentAt, user?.timezone, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div className="mt-4 border-t border-token pt-3">
            <button type="button" onClick={() => setExpandedId(expanded ? null : log.id)} aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'View'} email message for ${log.reminderType}`} className="inline-flex min-h-12 items-center gap-2 text-lg font-semibold text-caresync-900 underline-offset-4 hover:underline dark:text-caresync-100">
              <Mail size={20} aria-hidden="true" />{expanded ? 'Hide email message' : 'View email message'}
            </button>
            {expanded && <div className="mt-2 rounded-xl surface-subtle p-4 text-lg leading-relaxed whitespace-pre-line break-words">{log.body}</div>}
          </div>
        </Card>;
      })}
    </div>}
  </div>;
}
