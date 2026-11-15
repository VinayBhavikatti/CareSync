import { apiFetch } from './client';

export interface Medication {
  id: string;
  profileId: string;
  name: string;
  dosage: string;
  instructions: string | null;
  times: string[];
  stockCount: number;
  pillsPerDose: number;
  status: 'ACTIVE' | 'PENDING_APPROVAL' | 'ARCHIVED';
  proposedBy: 'ELDER' | 'CARETAKER';
  approvedAt: string | null;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationProposal {
  id: string;
  medicationId: string;
  profileId: string;
  proposedChanges: Partial<Medication>;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  createdAt: string;
  medication: Medication;
}

export interface MedicationsResponse {
  active: Medication[];
  pendingNew: Medication[];
  pendingChanges: MedicationProposal[];
  canApprove: boolean;
  canEdit: boolean;
}

export const medicationsApi = {
  getAll: (token: string) =>
    apiFetch<MedicationsResponse>('/api/medications', { token }),

  create: (token: string, payload: Partial<Medication>) =>
    apiFetch<{ medication: Medication; message: string }>('/api/medications', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    }),

  update: (token: string, id: string, payload: Partial<Medication>) =>
    apiFetch<{ medication?: Medication; proposal?: MedicationProposal; message: string }>(
      `/api/medications/${id}`,
      {
        method: 'PUT',
        token,
        body: JSON.stringify(payload),
      },
    ),

  delete: (token: string, id: string) =>
    apiFetch<{ message: string }>(`/api/medications/${id}`, {
      method: 'DELETE',
      token,
    }),

  approve: (token: string, id: string, proposalId?: string) =>
    apiFetch<{ message: string; medication?: Medication }>(`/api/medications/${id}/approve`, {
      method: 'POST',
      token,
      body: JSON.stringify({ proposalId }),
    }),

  decline: (token: string, id: string, proposalId?: string, reason?: string) =>
    apiFetch<{ message: string }>(`/api/medications/${id}/decline`, {
      method: 'POST',
      token,
      body: JSON.stringify({ proposalId, reason }),
    }),
};

