import { apiFetch } from './client';

export interface InsightsData {
  periodDays: number; overallAdherencePercent: number; totalPastDoses: number;
  totalTaken: number; totalMissed: number; totalSkipped: number;
  byMedicine: Array<{ medicationId: string; medicationName: string; dosage: string; adherencePercent: number; taken: number; missed: number; skipped: number; total: number }>;
  dailyTrend: Array<{ date: string; dayOfWeek: string; taken: number; missed: number; skipped: number; adherencePercent: number }>;
}
export interface Pattern { id: string; type: string; title: string; observation: string; sampleSize: number; metric: string }
export interface Refill { medicationId: string; medicationName: string; dosage: string; stockCount: number; dailyUsage: number; daysRemaining: number; estimatedRunOutDate: string; status: 'OK'|'WARNING'|'CRITICAL' }
export interface SummaryData { profile: { name: string } | null; reportDate: string; startDate: string; endDate: string; adherence: InsightsData; patterns: Pattern[]; refills: Refill[]; missedDoses: Array<{ id: string; medicationName: string; dosage: string; scheduledAt: string }>; upcomingAppointments: Array<{ id: string; title: string; doctorName: string|null; scheduledAt: string }> }
export const insightsApi = {
  adherence: (token: string, days: 7|30 = 7) => apiFetch<InsightsData>(`/api/insights/adherence?days=${days}`, { token }),
  patterns: (token: string, days = 30) => apiFetch<{ patterns: Pattern[] }>(`/api/insights/patterns?days=${days}`, { token }),
  refills: (token: string) => apiFetch<{ refills: Refill[] }>('/api/insights/refills', { token }),
  summary: (token: string, start: string, end: string) => apiFetch<SummaryData>(`/api/insights/doctor-summary?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, { token }),
};
