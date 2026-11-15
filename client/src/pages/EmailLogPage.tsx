import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  emailLogsApi,
  type EmailLogItem,
  type EmailReminderType,
} from '../api/emailLogs';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

function formatTimestamp(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getReminderTypeBadge(type: EmailReminderType): { label: string; color: string; icon: string } {
  switch (type) {
    case 'DOSE_UPCOMING':
      return { label: 'Upcoming Dose (15m)', color: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border-blue-400', icon: '⏰' };
    case 'DOSE_MISSED':
      return { label: 'Missed Alert (30m)', color: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-400', icon: '⚠️' };
    case 'DOSE_ESCALATION':
      return { label: 'Urgent Escalation (60m)', color: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200 border-red-500', icon: '🚨' };
    case 'DOSE_ALL_CLEAR':
      return { label: 'All Clear (Dose Taken)', color: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200 border-green-500', icon: '✅' };
    case 'APPOINTMENT_DAY_BEFORE':
      return { label: 'Appointment (Day Before)', color: 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200 border-purple-400', icon: '📅' };
    case 'APPOINTMENT_TWO_HOUR':
      return { label: 'Appointment (2 Hours)', color: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200 border-indigo-400', icon: '🗓️' };
    case 'PROPOSAL_NEEDS_APPROVAL':
      return { label: 'Needs Approval Alert', color: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200 border-orange-400', icon: '🔔' };
    default:
      return { label: type, color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-400', icon: '✉️' };
  }
}

export function EmailLogPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<EmailLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    try {
      setError('');
      const data = await emailLogsApi.getAll(user.token, 1, 100);
      setLogs(data.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load email history.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLogs();
    // Refresh whenever the demo clock advances
    const handler = () => fetchLogs();
    window.addEventListener('demo-clock-advanced', handler);
    return () => window.removeEventListener('demo-clock-advanced', handler);
  }, [fetchLogs]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            Email & Notification Log
          </h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 mt-1">
            History of reminders, alerts, and escalation emails sent by Kindred
          </p>
        </div>

        <Button
          variant="secondary"
          size="md"
          onClick={() => {
            setLoading(true);
            fetchLogs();
          }}
          className="shrink-0 gap-2"
        >
          🔄 Refresh
        </Button>
      </div>

      {error && (
        <div className="error-box" role="alert">
          <strong>⚠️ </strong>{error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-xl text-gray-500">Loading email history…</div>
      ) : logs.length === 0 ? (
        <Card className="text-center py-12">
          <span className="text-6xl block mb-3">📬</span>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">No emails dispatched yet</h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 mt-2">
            When medication times approach, missed doses occur, or appointments are scheduled, records of all outgoing notifications appear here.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {logs.map((log) => {
            const badge = getReminderTypeBadge(log.reminderType);
            const isSent = log.status === 'SENT';
            const isExpanded = expandedId === log.id;

            return (
              <div
                key={log.id}
                className="bg-white dark:bg-gray-800 p-5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 shadow-sm transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="flex-1">
                    {/* Top row: Badges */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-base font-bold border ${badge.color}`}
                      >
                        <span>{badge.icon}</span>
                        <span>{badge.label}</span>
                      </span>

                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                          isSent
                            ? 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 border border-green-400'
                            : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 border border-red-400'
                        }`}
                      >
                        {isSent ? '✓ SENT' : '✕ FAILED'}
                      </span>
                    </div>

                    {/* Subject */}
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {log.subject}
                    </h2>

                    {/* Recipient */}
                    <div className="text-lg font-medium text-gray-700 dark:text-gray-300 mt-1">
                      📨 <strong>Recipient:</strong>{' '}
                      <span className="font-mono text-kindred-600 dark:text-kindred-400">{log.recipient}</span>
                    </div>

                    {log.error && (
                      <p className="text-base text-red-600 dark:text-red-400 mt-1">
                        ⚠️ Error: {log.error}
                      </p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="text-base text-gray-500 dark:text-gray-400 shrink-0 md:text-right">
                    {formatTimestamp(log.sentAt)}
                  </div>
                </div>

                {/* Body Preview / Toggle */}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    className="text-base font-semibold text-kindred-600 dark:text-kindred-400 hover:underline min-h-[44px] flex items-center"
                  >
                    {isExpanded ? 'Hide email message ▲' : 'View email message ▼'}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 text-gray-800 dark:text-gray-200 font-sans text-base whitespace-pre-line border border-gray-200 dark:border-gray-700">
                      {log.body}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

