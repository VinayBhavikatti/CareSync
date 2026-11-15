import nodemailer from 'nodemailer';
import { PrismaClient, EmailStatus, EmailReminderType } from '@prisma/client';
import { env } from '../config/env.js';

const prisma = new PrismaClient();

// Configure Nodemailer transporter if SMTP settings provided
const isSmtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER);

const transporter = isSmtpConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    })
  : null;

interface SendEmailParams {
  profileId: string;
  entityId: string;
  entityType: 'DoseLog' | 'Appointment' | 'MedicationChangeProposal';
  reminderType: EmailReminderType;
  recipient: string;
  subject: string;
  body: string;
}

/**
 * Sends an email with retry logic and duplicate suppression.
 * Returns true if sent (or simulated), false if failed or duplicate.
 */
export async function sendEmailWithDeduplication(params: SendEmailParams): Promise<boolean> {
  const { profileId, entityId, entityType, reminderType, recipient, subject, body } = params;

  if (!recipient || !recipient.trim()) {
    return false;
  }

  // 1. Deduplication check: Has this exact reminder already been sent for this entity to this recipient?
  const existingSent = await prisma.emailLog.findUnique({
    where: {
      entityId_reminderType_recipient: {
        entityId,
        reminderType,
        recipient,
      },
    },
  });

  if (existingSent && existingSent.status === EmailStatus.SENT) {
    // Already sent! Prevent duplicate.
    return false;
  }

  // 2. Retry loop (up to 3 attempts with exponential backoff)
  const MAX_RETRIES = 3;
  let attempt = 0;
  let lastError: string | null = null;
  let success = false;

  while (attempt < MAX_RETRIES && !success) {
    attempt++;
    try {
      if (transporter) {
        await transporter.sendMail({
          from: env.EMAIL_FROM,
          to: recipient,
          subject,
          text: body,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 18px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px;">
              <div style="font-size: 24px; font-weight: bold; color: #ef6c24; margin-bottom: 16px;">
                ❤️ Kindred Care
              </div>
              <div style="white-space: pre-line; margin-bottom: 24px;">
                ${body}
              </div>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="font-size: 14px; color: #6b7280; margin: 0;">
                Kindred — Shared elder care & medication management.
              </p>
            </div>
          `,
        });
      } else {
        // Fallback: simulated send to console
        console.log(`\n📧 [EMAIL SIMULATION — SMTP not configured]`);
        console.log(`  To: ${recipient}`);
        console.log(`  Subject: ${subject}`);
        console.log(`  Type: ${reminderType}`);
        console.log(`  Body:\n${body}\n`);
      }
      success = true;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`Email send attempt ${attempt} failed for ${recipient}:`, lastError);
      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 300ms, 600ms
        await new Promise((resolve) => setTimeout(resolve, 300 * Math.pow(2, attempt - 1)));
      }
    }
  }

  // 3. Record in EmailLog table (upsert to handle retries cleanly)
  try {
    await prisma.emailLog.upsert({
      where: {
        entityId_reminderType_recipient: {
          entityId,
          reminderType,
          recipient,
        },
      },
      update: {
        status: success ? EmailStatus.SENT : EmailStatus.FAILED,
        error: lastError,
        retryCount: attempt,
        sentAt: new Date(),
      },
      create: {
        profileId,
        entityId,
        entityType,
        reminderType,
        recipient,
        subject,
        body,
        status: success ? EmailStatus.SENT : EmailStatus.FAILED,
        error: lastError,
        retryCount: attempt,
      },
    });
  } catch (err) {
    console.error('Failed to write EmailLog record:', err);
  }

  return success;
}

