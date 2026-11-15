import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // SMTP Configuration
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().optional().default(false),
  EMAIL_FROM: z.string().default('CareSync Care <notifications@caresync.local>'),
  // Demo Mode for hackathon presentations
  DEMO_MODE: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  // Optional services
  RESEND_API_KEY: z.string().optional(),
  ADAPTION_API_KEY: z.string().optional(),
  AI_TEXT_MODEL: z.string().default('deepseek-v4-flash'),
  AI_VISION_MODEL: z.string().default('gemma-4-31b-it'),
  AI_DAILY_CALL_LIMIT: z.coerce.number().int().positive().default(50),
  GEMINI_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  parsed.error.issues.forEach((issue) => {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = parsed.data;

