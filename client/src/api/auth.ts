import { apiFetch } from './client';
import type { Role } from '../types';

export interface LoginResponse {
  token: string;
  role: Role;
  profileId: string;
  elderName: string;
}

export interface CreateProfilePayload {
  name: string;
  elderPasscode: string;
  caretakerPasscode: string;
  familyPasscode: string;
  elderEmail?: string;
  caretakerEmail?: string;
  familyEmail?: string;
  timezone?: string;
}

export interface CreateProfileResponse {
  profileId: string;
  name: string;
  message: string;
}

export const authApi = {
  login: (profileId: string, role: Role, passcode: string) =>
    apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ profileId, role, passcode }),
    }),

  verify: (token: string) =>
    apiFetch<{ valid: boolean; profileId?: string; role?: Role; elderName?: string }>(
      '/api/auth/verify',
      { method: 'POST', token },
    ),

  createProfile: (payload: CreateProfilePayload) =>
    apiFetch<CreateProfileResponse>('/api/profiles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

