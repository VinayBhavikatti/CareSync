export type PrescriptionDraft = {
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  instructions: string;
};

export type AIFailureReason =
  | 'UNAVAILABLE' | 'DAILY_CAP' | 'DATABASE_ERROR' | 'TIMEOUT' | 'HTTP_ERROR'
  | 'TOKEN_LIMIT' | 'INCOMPLETE' | 'INVALID_JSON' | 'TRUNCATED_JSON'
  | 'INVALID_OUTPUT' | 'PROVIDER_ERROR';

export class AIProviderError extends Error {
  constructor(readonly reason: AIFailureReason, readonly statusCode?: number) {
    super(reason);
    this.name = 'AIProviderError';
  }
}

export type ReminderLanguage = 'ENGLISH' | 'HINDI' | 'KANNADA';
export type ReminderKey =
  | 'DOSE_UPCOMING' | 'DOSE_MISSED' | 'DOSE_ESCALATION' | 'DOSE_ALL_CLEAR'
  | 'APPOINTMENT_DAY_BEFORE' | 'APPOINTMENT_TWO_HOUR' | 'PROPOSAL_NEEDS_APPROVAL' | 'REFILL_WARNING';

export interface AIProvider {
  extractPrescription(imageBase64: string, mimeType: 'image/jpeg' | 'image/png'): Promise<PrescriptionDraft[]>;
  rewriteMessage(template: string, language: ReminderLanguage): Promise<string>;
  summarizeAdherence(data: unknown): Promise<string>;
}
