import { apiFetch } from './client';

export interface AuditLogItem {
  id: string;
  profileId: string;
  actor: 'ELDER' | 'CARETAKER' | 'FAMILY' | 'SYSTEM';
  action: string;
  entityType: string;
  entityId: string;
  before: any;
  after: any;
  createdAt: string;
}

export interface AuditLogsResponse {
  logs: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const auditApi = {
  getAll: (token: string, page = 1, limit = 50) =>
    apiFetch<AuditLogsResponse>(`/api/audit-logs?page=${page}&limit=${limit}`, { token }),
};

