import { apiFetch } from './client';
export interface PrescriptionDraft { name: string; dosage: string; frequency: string; times: string[]; instructions: string }
export type PrescriptionFailureReason = 'UNAVAILABLE'|'DAILY_CAP'|'DATABASE_ERROR'|'TIMEOUT'|'HTTP_ERROR'|'TOKEN_LIMIT'|'INCOMPLETE'|'INVALID_JSON'|'TRUNCATED_JSON'|'INVALID_OUTPUT'|'PROVIDER_ERROR';
export const aiApi = {
  prescriptionDraft: (token: string, mimeType: string, imageBase64: string) => apiFetch<{ drafts: PrescriptionDraft[] | null; reason?: PrescriptionFailureReason; statusCode?: number }>('/api/ai/prescription-draft', { method: 'POST', token, body: JSON.stringify({ mimeType, imageBase64 }) }),
  adherenceSummary: (token: string, data: unknown) => apiFetch<{ text: string; generated: boolean }>('/api/ai/adherence-summary', { method: 'POST', token, body: JSON.stringify(data) }),
};
