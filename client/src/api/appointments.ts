import { apiFetch } from './client';

export type AppointmentStatus = 'UPCOMING' | 'COMPLETED' | 'CANCELLED';

export interface Appointment {
  id: string;
  profileId: string;
  title: string;
  doctorName: string | null;
  location: string | null;
  scheduledAt: string;
  notes: string | null;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentsResponse {
  appointments: Appointment[];
  canEdit: boolean;
}

export const appointmentsApi = {
  getAll: (token: string) =>
    apiFetch<AppointmentsResponse>('/api/appointments', { token }),

  create: (token: string, payload: Partial<Appointment>) =>
    apiFetch<{ appointment: Appointment; message: string }>('/api/appointments', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    }),

  update: (token: string, id: string, payload: Partial<Appointment>) =>
    apiFetch<{ appointment: Appointment; message: string }>(`/api/appointments/${id}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(payload),
    }),

  delete: (token: string, id: string) =>
    apiFetch<{ message: string }>(`/api/appointments/${id}`, {
      method: 'DELETE',
      token,
    }),
};

