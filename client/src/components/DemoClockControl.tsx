import { useEffect, useState } from 'react';
import { Clock3, FastForward, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { emailLogsApi, type ClockStatusResponse } from '../api/emailLogs';
import { formatInTimeZone } from '../utils/timezone';
import { Button } from './Button';

export function DemoClockControl() {
  const { user } = useAuth();
  const [clock, setClock] = useState<ClockStatusResponse | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== 'ELDER') return;
    emailLogsApi.getClockStatus().then(setClock).catch(() => setError('Demo tools could not load. Refresh to try again.'));
  }, [user?.role]);

  if (user?.role !== 'ELDER' || !clock?.demoMode) return null;
  const time = formatInTimeZone(new Date(clock.virtualTime), user.timezone, { hour: '2-digit', minute: '2-digit', hour12: true });

  const run = async (minutes?: number) => {
    setLoading(true); setError('');
    try {
      const response = minutes === undefined ? await emailLogsApi.resetClock(user.token) : await emailLogsApi.advanceClock(user.token, minutes);
      setClock(response);
      setFeedback(minutes === undefined ? 'Clock reset. Reminders continue on the real schedule.' : `Advanced ${minutes} minutes. Reminder checks completed.`);
      window.dispatchEvent(new CustomEvent('demo-clock-advanced'));
    } catch { setError('The demo clock could not be updated. Please try again.'); }
    finally { setLoading(false); window.setTimeout(() => setFeedback(''), 5000); }
  };

  return <details className="mx-4 mt-4 rounded-xl border p-4 lg:mx-10" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 text-lg font-semibold">
      <Clock3 size={22} className="text-caresync-700 dark:text-caresync-300" aria-hidden="true" /> Demo tools <span className="text-base text-muted">Clock: {time}{clock.offsetMinutes ? ` (+${clock.offsetMinutes} min)` : ''}</span>
    </summary>
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
      <span className="mr-2 text-lg">Advance the demo clock:</span>
      {[15, 30, 60].map((minutes) => <Button key={minutes} size="sm" variant={minutes === 60 ? 'danger' : 'secondary'} disabled={loading} onClick={() => void run(minutes)}>
        <FastForward size={18} aria-hidden="true" /> +{minutes} minutes
      </Button>)}
      {clock.offsetMinutes > 0 && <Button size="sm" variant="ghost" disabled={loading} onClick={() => void run()}><RotateCcw size={18} aria-hidden="true" /> Reset</Button>}
      {feedback && <p className="w-full text-lg text-muted" role="status">{feedback}</p>}
      {(error || (clock && error)) && <p className="w-full text-lg text-rose-800 dark:text-rose-200" role="alert">{error}</p>}
    </div>
  </details>;
}
