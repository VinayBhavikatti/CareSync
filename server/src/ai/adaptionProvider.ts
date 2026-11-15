import { z } from 'zod';
import sharp from 'sharp';
import type { AIProvider, PrescriptionDraft, ReminderLanguage } from './AIProvider.js';
import { AIProviderError } from './AIProvider.js';
import { env } from '../config/env.js';

const prescriptionItemSchema = z.object({
  name: z.string().trim().max(120),
  dosage: z.string().trim().max(120),
  frequency: z.string().trim().max(120),
  times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).max(8),
  instructions: z.string().max(500).default(''),
}).strict();
export const prescriptionSchema = z.array(prescriptionItemSchema).min(1).max(40);

const safetyInstruction = 'Only restate the provided data. Do not give medical advice.';
const endpoint = 'https://api.prod.adaptionlabs.ai/api/v1/responses';

export class AdaptionLabsProvider implements AIProvider {
  async extractPrescription(imageBase64: string, mimeType: 'image/jpeg' | 'image/png'): Promise<PrescriptionDraft[]> {
    const resized = await resizePrescriptionImage(imageBase64, mimeType);
    const output = await this.request(env.AI_VISION_MODEL, [
      { role: 'user', content: [
        { type: 'input_text', text: 'Read the prescription image and extract every medicine that is visible. Return only a JSON array, with one object per medicine and exactly these fields: name, dosage, frequency, times (array of 24-hour HH:mm strings), and instructions. Include every medicine once. Do not infer unreadable information; use an empty string or empty times array when a field is unclear. Do not include patient names or other personal details.' },
        { type: 'input_image', image_url: `data:${resized.mimeType};base64,${resized.base64}` },
      ] },
    ], 1800, 30_000);

    let decoded: unknown;
    try {
      decoded = parsePrescriptionJson(output);
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError('INVALID_JSON');
    }
    const parsed = prescriptionSchema.safeParse(decoded);
    if (!parsed.success) throw new AIProviderError('INVALID_OUTPUT');
    return parsed.data;
  }

  async rewriteMessage(template: string, language: ReminderLanguage): Promise<string> {
    const output = await this.request(env.AI_TEXT_MODEL, `Translate this message into ${language}. Preserve all placeholders and facts. Only return the translated message.\n${template}`, 256, 10_000);
    return output.trim();
  }

  async summarizeAdherence(data: unknown): Promise<string> {
    const output = await this.request(env.AI_TEXT_MODEL, `Write a short, plain-language summary using only this JSON data. Keep all numbers exactly as supplied.\n${JSON.stringify(data)}`, 256, 10_000);
    return output.trim();
  }

  private async request(model: string, input: unknown, maxOutputTokens: number, timeoutMs: number): Promise<string> {
    const key = process.env.ADAPTION_API_KEY;
    if (!key) throw new AIProviderError('UNAVAILABLE');
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, instructions: safetyInstruction, input, max_output_tokens: maxOutputTokens, temperature: 0 }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new AIProviderError('TIMEOUT');
      throw new AIProviderError('PROVIDER_ERROR');
    }
    if (!response.ok) {
      const statusCode = response.status;
      await response.body?.cancel();
      throw new AIProviderError('HTTP_ERROR', statusCode);
    }

    let payload: { status?: string; output_text?: string; incomplete_details?: { reason?: string } };
    try {
      payload = await response.json() as typeof payload;
    } catch {
      throw new AIProviderError('INVALID_JSON');
    }
    if (payload.status === 'incomplete' && payload.incomplete_details?.reason === 'max_output_tokens') {
      throw new AIProviderError('TOKEN_LIMIT');
    }
    if (payload.status !== 'completed' || typeof payload.output_text !== 'string') {
      throw new AIProviderError('INCOMPLETE');
    }
    return payload.output_text;
  }
}

async function resizePrescriptionImage(imageBase64: string, mimeType: 'image/jpeg' | 'image/png') {
  const input = Buffer.from(imageBase64, 'base64');
  try {
    let pipeline = sharp(input, { limitInputPixels: 40_000_000 }).rotate().resize({
      width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true,
    });
    if (mimeType === 'image/jpeg') pipeline = pipeline.jpeg({ quality: 85 });
    else pipeline = pipeline.png({ compressionLevel: 9 });
    const output = await pipeline.toBuffer();
    return { base64: output.toString('base64'), mimeType };
  } catch {
    throw new AIProviderError('INVALID_OUTPUT');
  }
}

/** Accept a JSON array wrapped in markdown fences or surrounded by explanatory text. */
export function parsePrescriptionJson(output: string): unknown {
  let sawTruncatedArray = false;
  let sawInvalidArray = false;
  for (let start = output.indexOf('['); start >= 0; start = output.indexOf('[', start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < output.length; i++) {
      const char = output[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') { inString = true; continue; }
      if (char === '[') depth++;
      else if (char === ']') {
        depth--;
        if (depth === 0) {
          try {
            const candidate = JSON.parse(output.slice(start, i + 1));
            if (Array.isArray(candidate) && candidate.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item))) return candidate;
          } catch { sawInvalidArray = true; }
          break;
        }
      }
    }
    if (depth > 0) sawTruncatedArray = true;
  }
  if (sawTruncatedArray) throw new AIProviderError('TRUNCATED_JSON');
  throw new AIProviderError('INVALID_JSON');
}
