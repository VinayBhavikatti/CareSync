import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { dosesApi, type DoseItem, type DoseStatus } from '../api/doses';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

function formatDoseTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function TodayPage() {
  const { user } = useAuth();
  const [doses, setDoses] = useState<DoseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'info' } | null>(null);

  const fetchDoses = useCallback(async () => {
    if (!user) return;
    try {
      setError('');
      const data = await dosesApi.getToday(user.token);
      setDoses(data.doses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load today\'s doses.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDoses();
    const handler = () => fetchDoses();
    window.addEventListener('demo-clock-advanced', handler);
    return () => window.removeEventListener('demo-clock-advanced', handler);
  }, [fetchDoses]);

  const handleUpdateStatus = async (id: string, newStatus: DoseStatus) => {
    if (!user) return;
    setActionLoadingId(id);
    try {
      const res = await dosesApi.updateStatus(user.token, id, newStatus);
      // Update local dose item
      setDoses((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: res.dose.status, loggedAt: res.dose.loggedAt } : d)),
      );
      setNotification({
        msg: res.message,
        type: newStatus === 'TAKEN' ? 'success' : 'info',
      });
      setTimeout(() => setNotification(null), 4000);
      // Refresh to ensure stock count sync across doses
      fetchDoses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update dose.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const canMarkDoses = user?.role === 'ELDER' || user?.role === 'CARETAKER';

  // Metrics
  const totalCount = doses.length;
  const takenCount = doses.filter((d) => d.status === 'TAKEN').length;
  const pendingCount = doses.filter((d) => d.status === 'PENDING').length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* Title & Today's Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            Today's Medicines
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mt-1">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {totalCount > 0 && (
          <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="text-center px-3">
              <span className="block text-2xl font-bold text-green-600 dark:text-green-400">{takenCount}</span>
              <span className="text-base text-gray-500 dark:text-gray-400 font-medium">Taken</span>
            </div>
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
            <div className="text-center px-3">
              <span className="block text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingCount}</span>
              <span className="text-base text-gray-500 dark:text-gray-400 font-medium">Remaining</span>
            </div>
          </div>
        )}
      </div>

      {/* Notification banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-lg font-semibold flex items-center gap-3 ${
            notification.type === 'success'
              ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-2 border-green-500'
              : 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-2 border-blue-500'
          }`}
          role="status"
          aria-live="polite"
        >
          <span className="text-2xl">{notification.type === 'success' ? '✅' : 'ℹ️'}</span>
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Error box */}
      {error && (
        <div className="error-box" role="alert">
          <strong>⚠️ </strong>{error}
        </div>
      )}

      {/* Family read-only notice */}
      {user?.role === 'FAMILY' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-xl p-4 text-blue-800 dark:text-blue-200 text-lg flex items-center gap-3">
          <span className="text-2xl">👨‍👩‍👧</span>
          <span>You are viewing today's dose schedule in read-only mode.</span>
        </div>
      )}

      {/* Doses List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin text-4xl mb-3">⏳</div>
          <p className="text-xl text-gray-500 dark:text-gray-400">Loading today's schedule…</p>
        </div>
      ) : doses.length === 0 ? (
        <Card className="text-center py-12">
          <span className="text-6xl block mb-3">🎉</span>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">No doses scheduled for today!</h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 mt-2">
            Either no medications have been added yet, or none are scheduled for today.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {doses.map((dose) => {
            const isTaken = dose.status === 'TAKEN';
            const isSkipped = dose.status === 'SKIPPED';
            const isPending = dose.status === 'PENDING';
            const isMissed = dose.status === 'MISSED';
            const isActionBusy = actionLoadingId === dose.id;

            return (
              <div
                key={dose.id}
                className={`
                  p-6 rounded-2xl border-2 transition-all shadow-sm
                  ${isTaken
                    ? 'bg-green-50/80 dark:bg-green-950/20 border-green-500 dark:border-green-600'
                    : isSkipped
                    ? 'bg-gray-100/80 dark:bg-gray-800/60 border-gray-400 dark:border-gray-600 opacity-80'
                    : isMissed
                    ? 'bg-red-50/80 dark:bg-red-950/20 border-red-500 dark:border-red-600'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-kindred-400'
                  }
                `}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Dose details */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white">
                        ⏰ {formatDoseTime(dose.scheduledAt)}
                      </span>

                      {/* Status indicator: TEXT + ICON + COLOR */}
                      {isTaken && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-lg bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100">
                          ✅ TAKEN
                        </span>
                      )}
                      {isSkipped && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-lg bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                          ⏭️ SKIPPED
                        </span>
                      )}
                      {isMissed && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-lg bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100">
                          ⚠️ MISSED
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-lg bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-100">
                          ⏳ DUE
                        </span>
                      )}

                      {/* Reminder / Escalation status tags */}
                      {dose.reminderTypesSent?.includes('DOSE_ESCALATION') && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold text-base bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200 border border-red-400">
                          🚨 Escalated to family
                        </span>
                      )}
                      {!dose.reminderTypesSent?.includes('DOSE_ESCALATION') &&
                        dose.reminderTypesSent?.includes('DOSE_MISSED') && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold text-base bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-400">
                            ⚠️ Missed alert sent
                          </span>
                        )}
                      {dose.reminderTypesSent?.includes('DOSE_UPCOMING') && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-semibold text-base bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border border-blue-400">
                          🔔 Reminder sent
                        </span>
                      )}
                      {dose.reminderTypesSent?.includes('DOSE_ALL_CLEAR') && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-semibold text-base bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200 border border-green-400">
                          ✅ All clear sent
                        </span>
                      )}
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {dose.medication.name}{' '}
                      <span className="text-xl font-semibold text-kindred-600 dark:text-kindred-400">
                        ({dose.medication.dosage})
                      </span>
                    </h2>

                    {dose.medication.instructions && (
                      <p className="text-lg text-gray-600 dark:text-gray-300 mt-1 font-medium">
                        📝 {dose.medication.instructions}
                      </p>
                    )}

                    <p className="text-base text-gray-500 dark:text-gray-400 mt-2">
                      💊 Stock remaining: <strong>{dose.medication.stockCount} pills</strong>
                    </p>
                  </div>

                  {/* Right: Actions */}
                  {canMarkDoses && (
                    <div className="flex flex-row md:flex-col gap-3 shrink-0">
                      {!isTaken ? (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(dose.id, 'TAKEN')}
                          disabled={isActionBusy}
                          className="
                            flex-1 md:flex-none min-h-[56px] px-6 py-3 rounded-2xl font-bold text-xl
                            bg-green-600 text-white hover:bg-green-700 active:bg-green-800
                            focus-visible:ring-4 focus-visible:ring-green-400 shadow-md
                            transition-all flex items-center justify-center gap-2
                            disabled:opacity-50
                          "
                        >
                          {isActionBusy ? '⏳…' : '✓ I took it'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(dose.id, 'PENDING')}
                          disabled={isActionBusy}
                          className="
                            min-h-[48px] px-4 py-2 rounded-xl font-semibold text-base
                            bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200
                            hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors
                          "
                        >
                          Undo
                        </button>
                      )}

                      {!isTaken && !isSkipped && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(dose.id, 'SKIPPED')}
                          disabled={isActionBusy}
                          className="
                            min-h-[48px] px-5 py-2.5 rounded-xl font-semibold text-lg
                            bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200
                            hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors
                          "
                        >
                          Skip
                        </button>
                      )}
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

