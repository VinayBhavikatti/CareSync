import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { auditApi, type AuditLogItem } from '../api/audit';
import { Card } from '../components/Card';
import { RoleBadge } from '../components/RoleBadge';

function formatTimestamp(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getActionLabel(action: string): { title: string; icon: string } {
  switch (action) {
    case 'MEDICATION_CREATED':
      return { title: 'Added medication directly', icon: '💊' };
    case 'MEDICATION_PROPOSED_BY_CARETAKER':
      return { title: 'Proposed new medication (awaiting approval)', icon: '📝' };
    case 'MEDICATION_UPDATE_PROPOSED':
      return { title: 'Proposed changes to medication (awaiting approval)', icon: '✏️' };
    case 'MEDICATION_PROPOSAL_APPROVED':
      return { title: 'Approved new medication proposal', icon: '✅' };
    case 'MEDICATION_CHANGE_APPROVED':
      return { title: 'Approved changes to medication', icon: '✅' };
    case 'MEDICATION_PROPOSAL_DECLINED':
      return { title: 'Declined proposed medication', icon: '❌' };
    case 'MEDICATION_CHANGE_DECLINED':
      return { title: 'Declined medication changes', icon: '❌' };
    case 'MEDICATION_UPDATED':
      return { title: 'Updated medication', icon: '✏️' };
    case 'MEDICATION_ARCHIVED':
      return { title: 'Archived medication', icon: '📦' };
    case 'DOSE_MARKED_TAKEN':
      return { title: 'Marked dose as TAKEN', icon: '✅' };
    case 'DOSE_MARKED_SKIPPED':
      return { title: 'Marked dose as SKIPPED', icon: '⏭️' };
    case 'APPOINTMENT_CREATED':
      return { title: 'Scheduled doctor appointment', icon: '📅' };
    case 'APPOINTMENT_UPDATED':
      return { title: 'Updated appointment details', icon: '🗓️' };
    case 'APPOINTMENT_DELETED':
      return { title: 'Cancelled / deleted appointment', icon: '🗑️' };
    case 'PROFILE_CREATED':
      return { title: 'Care profile created', icon: '❤️' };
    case 'PROFILE_SEEDED':
      return { title: 'Profile initialised with demo data', icon: '🌱' };
    default:
      return { title: action.replace(/_/g, ' '), icon: '📋' };
  }
}

export function AuditLogPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    try {
      setError('');
      const data = await auditApi.getAll(user.token, 1, 100);
      setLogs(data.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load audit log.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
          Activity & Audit Log
        </h1>
        <p className="text-xl text-gray-500 dark:text-gray-400 mt-1">
          Complete, tamper-proof history of who changed what and when
        </p>
      </div>

      {error && (
        <div className="error-box" role="alert">
          <strong>⚠️ </strong>{error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-xl text-gray-500">Loading activity…</div>
      ) : logs.length === 0 ? (
        <Card className="text-center py-12">
          <span className="text-6xl block mb-3">📜</span>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">No activity logged yet</h2>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map((log) => {
            const { title, icon } = getActionLabel(log.action);
            return (
              <div
                key={log.id}
                className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl p-2 bg-gray-50 dark:bg-gray-700 rounded-xl shrink-0">
                    {icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xl font-bold text-gray-900 dark:text-white">
                        {title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-base text-gray-500 dark:text-gray-400 flex-wrap">
                      <span>By</span>
                      {log.actor === 'SYSTEM' ? (
                        <span className="px-2 py-0.5 rounded text-sm font-semibold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                          SYSTEM
                        </span>
                      ) : (
                        <RoleBadge role={log.actor as any} className="text-sm py-0.5" />
                      )}
                      <span>•</span>
                      <span>Target: {log.entityType}</span>
                    </div>
                  </div>
                </div>

                <div className="text-base text-gray-500 dark:text-gray-400 md:text-right shrink-0">
                  {formatTimestamp(log.createdAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

