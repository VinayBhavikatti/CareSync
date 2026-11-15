import { useEffect, useState, useCallback } from 'react';
import { Archive, CalendarDays, Check, CircleUserRound, FileText, Pencil, Pill, ShieldCheck, SkipForward, Trash2, UserPlus, UsersRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auditApi, type AuditLogItem } from '../api/audit';
import { Card } from '../components/Card';
import { RoleBadge } from '../components/RoleBadge';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { CardSkeleton } from '../components/Skeleton';
import { formatInTimeZone } from '../utils/timezone';

function actionDetails(action: string): { title: string; Icon: LucideIcon } {
  switch (action) {
    case 'MEDICATION_CREATED': return { title: 'Added a medicine', Icon: Pill };
    case 'MEDICATION_PROPOSED_BY_CARETAKER': return { title: 'Proposed a medicine for approval', Icon: FileText };
    case 'MEDICATION_UPDATE_PROPOSED': return { title: 'Proposed medicine changes', Icon: Pencil };
    case 'MEDICATION_PROPOSAL_APPROVED': return { title: 'Approved a medicine proposal', Icon: Check };
    case 'MEDICATION_CHANGE_APPROVED': return { title: 'Approved medicine changes', Icon: ShieldCheck };
    case 'MEDICATION_PROPOSAL_DECLINED': return { title: 'Declined a medicine proposal', Icon: Trash2 };
    case 'MEDICATION_CHANGE_DECLINED': return { title: 'Declined medicine changes', Icon: Trash2 };
    case 'MEDICATION_UPDATED': return { title: 'Updated a medicine', Icon: Pencil };
    case 'MEDICATION_ARCHIVED': return { title: 'Archived a medicine', Icon: Archive };
    case 'DOSE_MARKED_TAKEN': return { title: 'Marked a dose taken', Icon: Check };
    case 'DOSE_MARKED_SKIPPED': return { title: 'Marked a dose skipped', Icon: SkipForward };
    case 'APPOINTMENT_CREATED': return { title: 'Scheduled an appointment', Icon: CalendarDays };
    case 'APPOINTMENT_UPDATED': return { title: 'Updated appointment details', Icon: CalendarDays };
    case 'APPOINTMENT_DELETED': return { title: 'Cancelled or deleted an appointment', Icon: Trash2 };
    case 'PROFILE_CREATED': return { title: 'Created a care profile', Icon: UsersRound };
    case 'PROFILE_SEEDED': return { title: 'Initialised profile demo data', Icon: UserPlus };
    default: return { title: action.replace(/_/g, ' '), Icon: CircleUserRound };
  }
}

export function AuditLogPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fetchLogs = useCallback(async () => {
    if (!user) return;
    try { setError(''); const data = await auditApi.getAll(user.token, 1, 100); setLogs(data.logs); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load the activity log.'); }
    finally { setLoading(false); }
  }, [user]);
  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  return <div className="flex flex-col gap-6">
    <PageHeader title="Activity" description="A record of care changes, dose updates, and approvals." />
    {error && <div className="error-box flex flex-wrap items-center justify-between gap-3" role="alert"><span>{error}</span><Button variant="secondary" onClick={() => void fetchLogs()}>Try again</Button></div>}
    {loading ? <div className="grid gap-3" role="status" aria-label="Loading activity"><CardSkeleton /><CardSkeleton /></div> : error && logs.length === 0 ? <EmptyState title="Activity could not be loaded" description="Check your connection, then try again." action={<Button onClick={() => void fetchLogs()}>Try again</Button>} /> : logs.length === 0 ? <EmptyState title="No activity recorded yet" description="Care profile changes and dose updates will appear here." icon={<FileText size={36} />} /> : <div className="grid gap-3">
      {logs.map((log) => {
        const { title, Icon } = actionDetails(log.action);
        return <Card key={log.id} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-4">
            <div className="rounded-xl surface-subtle p-3 text-caresync-800 dark:text-caresync-200"><Icon size={24} aria-hidden="true" /></div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold">{title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-lg text-muted"><span>By</span>{log.actor === 'SYSTEM' ? <span className="rounded-full bg-slate-200 px-3 py-1 font-semibold text-slate-950 dark:bg-slate-700 dark:text-slate-100">System</span> : <RoleBadge role={log.actor as any} />}<span>·</span><span>Target: {log.entityType}</span></div>
            </div>
          </div>
          <p className="shrink-0 text-lg text-muted sm:text-right">{formatInTimeZone(log.createdAt, user?.timezone, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </Card>;
      })}
    </div>}
  </div>;
}
