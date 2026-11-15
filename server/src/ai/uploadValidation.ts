export const MAX_PRESCRIPTION_IMAGE_BYTES = 5 * 1024 * 1024;
export type PrescriptionMimeType = 'image/jpeg' | 'image/png';

export function validatePrescriptionUpload(mimeType: string, base64: string): { valid: true; mimeType: PrescriptionMimeType } | { valid: false } {
  if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') return { valid: false };
  if (!base64 || base64.length > Math.ceil(MAX_PRESCRIPTION_IMAGE_BYTES * 4 / 3) + 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) return { valid: false };
  const bytes = Math.floor(base64.length * 3 / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
  if (!bytes || bytes > MAX_PRESCRIPTION_IMAGE_BYTES) return { valid: false };
  return { valid: true, mimeType };
}
