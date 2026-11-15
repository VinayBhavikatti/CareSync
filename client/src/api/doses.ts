import { apiFetch } from './client';

export type DoseStatus = 'PENDING' | 'TAKEN' | 'SKIPPED' | 'MISSED';

export interface DoseItem {
  id: string;
  medicationId: string;
  profileId: string;
  scheduledAt: string;
  status: DoseStatus;
  loggedAt: string | null;
  loggedBy: string | null;
  note: string | null;
  reminderTypesSent?: string[];
  medication: {
    id: string;
    name: string;
    dosage: string;
    instructions: string | null;
    stockCount: number;
    pillsPerDose: number;
    times: string[];
  };
}

export interface TodayDosesResponse {
  date: string;
  doses: DoseItem[];
}

export const dosesApi = {
  getToday: (token: string) =>
    apiFetch<TodayDosesResponse>('/api/doses/today', { token }),

  updateStatus: (token: string, id: string, status: DoseStatus, note?: string) =>
    apiFetch<{ dose: DoseItem; remainingStock: number; message: string }>(
      `/api/doses/${id}/status`,
      {
        method: 'POST',
        token,
        body: JSON.stringify({ status, note }),
      },
    ),
};

