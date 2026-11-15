import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { emailLogsApi, type ClockStatusResponse } from '../api/emailLogs';

export function DemoClockControl() {
  const { user } = useAuth();
  const [clock, setClock] = useState<ClockStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    emailLogsApi
      .getClockStatus()
      .then((data) => setClock(data))
      .catch(() => {});
  }, []);

  if (!clock?.demoMode || user?.role !== 'ELDER') {
    return null;
  }

  const handleAdvance = async (minutes: number) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await emailLogsApi.advanceClock(user.token, minutes);
      setClock(res);
      setFeedback(`Clock advanced +${minutes}m! Scheduled reminders processed.`);
      setTimeout(() => setFeedback(''), 4000);
      // Trigger a window event so pages (like Today) can auto-refresh
      window.dispatchEvent(new CustomEvent('demo-clock-advanced'));
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Failed to advance clock.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await emailLogsApi.resetClock(user.token);
      setClock(res);
      setFeedback('Clock reset to real time.');
      setTimeout(() => setFeedback(''), 4000);
      window.dispatchEvent(new CustomEvent('demo-clock-advanced'));
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Failed to reset clock.');
    } finally {
      setLoading(false);
    }
  };

  const virtualDate = new Date(clock.virtualTime);
  const formattedVirtualTime = virtualDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white px-4 py-3 border-b-2 border-purple-500 shadow-md">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Indicator */}
        <div className="flex items-center gap-3">
          <span className="text-2xl animate-pulse">⚡</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-yellow-300">DEMO MODE CLOCK:</span>
              <span className="font-bold text-xl bg-purple-950 px-2.5 py-0.5 rounded-lg border border-purple-400">
                {formattedVirtualTime}
              </span>
              {clock.offsetMinutes > 0 && (
                <span className="text-sm font-semibold text-purple-200">
                  (+{clock.offsetMinutes}m shifted)
                </span>
              )}
            </div>
            {feedback && <div className="text-sm text-green-300 font-semibold">{feedback}</div>}
          </div>
        </div>

        {/* Right: Fast forward buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-purple-200 mr-1 hidden md:inline">
            Fast-forward:
          </span>
          <button
            type="button"
            onClick={() => handleAdvance(15)}
            disabled={loading}
            className="min-h-[44px] px-3.5 py-1.5 rounded-xl font-bold text-base bg-purple-700 hover:bg-purple-600 active:bg-purple-800 transition-colors border border-purple-400 disabled:opacity-50"
            title="Advance 15 minutes (triggers upcoming dose reminder)"
          >
            +15m
          </button>
          <button
            type="button"
            onClick={() => handleAdvance(30)}
            disabled={loading}
            className="min-h-[44px] px-3.5 py-1.5 rounded-xl font-bold text-base bg-amber-600 hover:bg-amber-500 active:bg-amber-700 transition-colors border border-amber-300 disabled:opacity-50"
            title="Advance 30 minutes (triggers missed dose alert)"
          >
            +30m
          </button>
          <button
            type="button"
            onClick={() => handleAdvance(60)}
            disabled={loading}
            className="min-h-[44px] px-3.5 py-1.5 rounded-xl font-bold text-base bg-red-600 hover:bg-red-500 active:bg-red-700 transition-colors border border-red-300 disabled:opacity-50"
            title="Advance 60 minutes (triggers escalation to family and caretaker!)"
          >
            🚨 +60m Escalation
          </button>
          {clock.offsetMinutes > 0 && (
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="min-h-[44px] px-3 py-1.5 rounded-xl font-semibold text-base bg-gray-700 hover:bg-gray-600 transition-colors text-gray-200"
            >
              ↺ Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

