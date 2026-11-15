import test from 'node:test';
import assert from 'node:assert/strict';
import type { AIProvider } from '../ai/AIProvider.js';
import { AIProviderError } from '../ai/AIProvider.js';
import { extractPrescription, summarizeAdherence, MemoryDailyCallLimiter, setAIProviderForTests, setDailyCallLimiterForTests, resetAITestOverrides } from '../ai/aiService.js';
import { parsePrescriptionJson, prescriptionSchema } from '../ai/adaptionProvider.js';
import { MAX_PRESCRIPTION_IMAGE_BYTES, validatePrescriptionUpload } from '../ai/uploadValidation.js';

const mockProvider: AIProvider = {
  async extractPrescription() { return [{ name: 'Example', dosage: '1 tablet', frequency: 'once daily', times: ['08:00'], instructions: '' }]; },
  async rewriteMessage(template) { return template; },
  async summarizeAdherence() { return 'Three doses were recorded.'; },
};

test('AI interface mock and fallback path return safe output without throwing', async () => {
  const originalKey = process.env.ADAPTION_API_KEY;
  process.env.ADAPTION_API_KEY = 'test-only';
  setAIProviderForTests({ ...mockProvider, async summarizeAdherence() { throw new Error('private provider error'); } });
  setDailyCallLimiterForTests(new MemoryDailyCallLimiter(5));
  const result = await summarizeAdherence({ taken: 3 }, 'Three doses were recorded.');
  assert.deepEqual(result, { text: 'Three doses were recorded.', generated: false });
  if (originalKey === undefined) delete process.env.ADAPTION_API_KEY; else process.env.ADAPTION_API_KEY = originalKey;
  resetAITestOverrides();
});

test('daily call cap is enforced and resets on the next UTC day', async () => {
  const cap = new MemoryDailyCallLimiter(1);
  assert.equal(await cap.reserve(new Date('2026-11-15T10:00:00Z')), true);
  assert.equal(await cap.reserve(new Date('2026-11-15T11:00:00Z')), false);
  assert.equal(await cap.reserve(new Date('2026-11-16T00:00:00Z')), true);
});

test('prescription schema rejects malformed model output', () => {
  assert.equal(prescriptionSchema.safeParse([{ name: 'Rx', dosage: '5 mg', frequency: 'daily', times: ['9am'], instructions: '' }]).success, false);
  assert.equal(prescriptionSchema.safeParse([{ name: 'Rx', dosage: '5 mg', frequency: 'daily', times: ['09:00'], instructions: '' }]).success, true);
});

test('prescription parser accepts fenced JSON and surrounding explanation', () => {
  const medicine = { name: 'Rx', dosage: '5 mg', frequency: 'daily', times: ['09:00'], instructions: '' };
  assert.deepEqual(parsePrescriptionJson(`Here is the result:\n\`\`\`json\n${JSON.stringify([medicine])}\n\`\`\``), [medicine]);
});

test('prescription parser reports truncated JSON distinctly', () => {
  assert.throws(() => parsePrescriptionJson('[{"name":"Rx","times":["09:00"]'), (error: unknown) => error instanceof AIProviderError && error.reason === 'TRUNCATED_JSON');
});

test('prescription upload reports timeout for mock provider without throwing', async () => {
  const originalKey = process.env.ADAPTION_API_KEY;
  process.env.ADAPTION_API_KEY = 'test-only';
  setAIProviderForTests({ ...mockProvider, async extractPrescription() { throw new AIProviderError('TIMEOUT'); } });
  setDailyCallLimiterForTests(new MemoryDailyCallLimiter(5));
  assert.deepEqual(await extractPrescription('c2FmZQ==', 'image/png'), { drafts: null, reason: 'TIMEOUT' });
  if (originalKey === undefined) delete process.env.ADAPTION_API_KEY; else process.env.ADAPTION_API_KEY = originalKey;
  resetAITestOverrides();
});

test('photo validation accepts JPG and PNG and rejects invalid type or oversized data', () => {
  const onePixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jHn8AAAAASUVORK5CYII=';
  assert.equal(validatePrescriptionUpload('image/png', onePixel).valid, true);
  assert.equal(validatePrescriptionUpload('image/gif', onePixel).valid, false);
  assert.equal(validatePrescriptionUpload('image/jpeg', 'A'.repeat(Math.ceil(MAX_PRESCRIPTION_IMAGE_BYTES * 4 / 3) + 8)).valid, false);
});
