// Shared types used across client
export type Role = 'ELDER' | 'CARETAKER' | 'FAMILY';

export interface AuthUser {
  profileId: string;
  role: Role;
  elderName: string;
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
  ELDER: 'bg-kindred-100 text-kindred-800 dark:bg-kindred-900 dark:text-kindred-200',
  CARETAKER: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  FAMILY: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

