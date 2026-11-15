import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { AdaptionLabsProvider } from './adaptionProvider.js';
import { AIProviderError, type AIProvider, type AIFailureReason, type PrescriptionDraft, type ReminderLanguage } from './AIProvider.js';

const prisma = new PrismaClient();
let provider: AIProvider = new AdaptionLabsProvider();

export interface DailyCallLimiter { reserve(now?: Date): Promise<boolean> }

export class MemoryDailyCallLimiter implements DailyCallLimiter {
  private day = '';
  private count = 0;
  constructor(private readonly limit: number) {}
  async reserve(now = new Date()): Promise<boolean> {
    const today = now.toISOString().slice(0, 10);
    if (today !== this.day) { this.day = today; this.count = 0; }
    if (this.count >= this.limit) return false;
    this.count++;
    return true;
  }
}

class PrismaDailyCallLimiter implements DailyCallLimiter {
  async reserve(now = new Date()): Promise<boolean> {
    const day = now.toISOString().slice(0, 10);
    await prisma.aICallUsage.upsert({
      where: { day },
      create: { day, count: 0, updatedAt: now },
      update: {},
    });
    const reserved = await prisma.aICallUsage.updateMany({
      where: { day, count: { lt: env.AI_DAILY_CALL_LIMIT } },
      data: { count: { increment: 1 } },
    });
    return reserved.count === 1;
  }
}

let limiter: DailyCallLimiter = new PrismaDailyCallLimiter();
export function setDailyCallLimiterForTests(next: DailyCallLimiter) { limiter = next; }
export function setAIProviderForTests(next: AIProvider) { provider = next; }
export function resetAITestOverrides() { provider = new AdaptionLabsProvider(); limiter = new PrismaDailyCallLimiter(); }

async function safeCall<T>(action: () => Promise<T>, fallback: T): Promise<T> {
  try {
    if (!process.env.ADAPTION_API_KEY || !(await limiter.reserve())) return fallback;
    return await action();
  } catch {
    // Do not log request data, responses, provider errors, or credentials.
    return fallback;
  }
}

export async function extractPrescription(imageBase64: string, mimeType: 'image/jpeg' | 'image/png'): Promise<{ drafts: PrescriptionDraft[] | null; reason?: AIFailureReason; statusCode?: number }> {
  if (!process.env.ADAPTION_API_KEY) return { drafts: null, reason: 'UNAVAILABLE' };
  try {
    if (!(await limiter.reserve())) return { drafts: null, reason: 'DAILY_CAP' };
  } catch {
    return { drafts: null, reason: 'DATABASE_ERROR' };
  }
  try {
    return { drafts: await provider.extractPrescription(imageBase64, mimeType) };
  } catch (error) {
    return {
      drafts: null,
      reason: getAIFailureReason(error),
      ...(error instanceof AIProviderError && error.statusCode ? { statusCode: error.statusCode } : {}),
    };
  }
}

function getAIFailureReason(error: unknown): AIFailureReason {
  if (error instanceof AIProviderError) return error.reason;
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return 'TIMEOUT';
  if (error instanceof Error && error.name === 'ZodError') return 'INVALID_OUTPUT';
  if (error instanceof SyntaxError) return 'INVALID_JSON';
  return 'PROVIDER_ERROR';
}

export function rewriteMessage(template: string, language: ReminderLanguage, fallback: string) {
  return safeCall(() => provider.rewriteMessage(template, language), fallback);
}

export function summarizeAdherence(data: unknown, fallback: string) {
  let generated = false;
  return safeCall(async () => {
    const text = await provider.summarizeAdherence(data);
    generated = true;
    return { text, generated };
  }, { text: fallback, generated: false });
}
