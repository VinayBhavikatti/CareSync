import { apiFetch } from './client';

export type EmailStatus = 'SENT' | 'FAILED';

export type EmailReminderType =
  | 'DOSE_UPCOMING'
  | 'DOSE_MISSED'
  | 'DOSE_ESCALATION'
  | 'DOSE_ALL_CLEAR'
  | 'APPOINTMENT_DAY_BEFORE'
  | 'APPOINTMENT_TWO_HOUR'
  | 'PROPOSAL_NEEDS_APPROVAL';

export interface EmailLogItem {
  id: string;
  profileId: string;
  entityId: string;
  entityType: string;
  reminderType: EmailReminderType;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  error: string | null;
  retryCount: number;
  sentAt: string;
}

export interface EmailLogsResponse {
  logs: EmailLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ClockStatusResponse {
  realTime: string;
  virtualTime: string;
  offsetMinutes: number;
  demoMode: boolean;
}

export const emailLogsApi = {
  getAll: (token: string, page = 1, limit = 50) =>
    apiFetch<EmailLogsResponse>(`/api/email-logs?page=${page}&limit=${limit}`, { token }),

  getClockStatus: () =>
    apiFetch<ClockStatusResponse>('/api/demo/clock/status'),

  advanceClock: (token: string, minutes: number) =>
    apiFetch<ClockStatusResponse & { message: string }>('/api/demo/clock/advance', {
      method: 'POST',
      token,
      body: JSON.stringify({ minutes }),
    }),

  resetClock: (token: string) =>
    apiFetch<ClockStatusResponse & { message: string }>('/api/demo/clock/reset', {
      method: 'POST',
      token,
      body: JSON.stringify({}),
    }),
};

