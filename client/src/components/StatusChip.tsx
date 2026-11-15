import type { ReactNode } from 'react';
import { AlarmClock, CheckCircle2, CircleX, SkipForward } from 'lucide-react';
export type StatusKind = 'TAKEN' | 'DUE' | 'MISSED' | 'SKIPPED' | 'PENDING' | 'APPROVED' | 'SIMULATED' | 'SENT' | 'FAILED';
const styles: Record<StatusKind, string> = {
  TAKEN: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100',
  DUE: 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100',
  MISSED: 'bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-100',
  SKIPPED: 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100',
  PENDING: 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100',
  APPROVED: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100',
  SIMULATED: 'bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-100',
  SENT: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100',
  FAILED: 'bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-100',
};
export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex min-h-8 items-center rounded-full border border-current/20 px-3 py-1 text-base font-semibold ${className}`}>{children}</span>;
}
export function StatusChip({ status, label, icon }: { status: StatusKind; label?: string; icon?: ReactNode }) {
  const words: Record<StatusKind, string> = { TAKEN: 'Taken', DUE: 'Due', MISSED: 'Missed', SKIPPED: 'Skipped', PENDING: 'Pending approval', APPROVED: 'Approved', SIMULATED: 'Simulated', SENT: 'Sent', FAILED: 'Failed' };
  const statusIcons: Partial<Record<StatusKind, ReactNode>> = {
    TAKEN: <CheckCircle2 size={18} aria-hidden="true" />,
    DUE: <AlarmClock size={18} aria-hidden="true" />,
    MISSED: <CircleX size={18} aria-hidden="true" />,
    SKIPPED: <SkipForward size={18} aria-hidden="true" />,
  };
  return <Badge className={`gap-1.5 transition-colors duration-300 ${styles[status]}`}>{icon ?? statusIcons[status]}{label ?? words[status]}</Badge>;
}
