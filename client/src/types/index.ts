// Shared types used across client
export type Role = 'ELDER' | 'CARETAKER' | 'FAMILY';

export interface AuthUser {
  profileId: string;
  role: Role;
  elderName: string;
  timezone: string;
  token: string;
}

export interface ApiError {
  error: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  ELDER: 'Elder',
  CARETAKER: 'Caretaker',
  FAMILY: 'Family Member',
};

export const ROLE_COLORS: Record<Role, string> = {
  ELDER: 'bg-caresync-100 text-caresync-900 dark:bg-caresync-900 dark:text-caresync-100',
  CARETAKER: 'bg-blue-100 text-blue-950 dark:bg-blue-950 dark:text-blue-100',
  FAMILY: 'bg-slate-200 text-slate-950 dark:bg-slate-700 dark:text-slate-100',
};

