import { apiFetch } from './client';
export type ReminderLanguage = 'ENGLISH'|'HINDI'|'KANNADA';
export const profileApi = {
  getLanguage: (token: string) => apiFetch<{language:ReminderLanguage}>('/api/profiles/me/language',{token}),
  setLanguage: (token: string, language: ReminderLanguage) => apiFetch<{language:ReminderLanguage}>('/api/profiles/me/language',{method:'PATCH',token,body:JSON.stringify({language})}),
};
