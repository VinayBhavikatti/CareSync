import { PrismaClient, DoseStatus, EmailReminderType, AppointmentStatus } from '@prisma/client';
import { getCurrentTime } from '../utils/clock.js';
import { ensureTodayDosesForProfile } from './doseGenerator.js';
import { sendEmailWithDeduplication } from './emailService.js';
import { checkAndSendRefillAlerts } from './insightsService.js';
import { getReminderText } from '../notifications/translations.js';
import { formatLocalDateTime, formatLocalTime } from '../utils/timezone.js';

const prisma = new PrismaClient();

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Main cron worker tick. Runs every minute.
 */
export async function runReminderSchedulerTick(): Promise<void> {
  const now = getCurrentTime();

  try {
    // ── STEP 1: Pre-generate DoseLog rows for today for all care profiles ─────
    const profiles = await prisma.careProfile.findMany({
      select: {
        id: true,
        name: true,
        elderEmail: true,
        caretakerEmail: true,
        familyEmail: true,
        timezone: true,
      },
    });

    for (const profile of profiles) {
      try {
        await ensureTodayDosesForProfile(profile.id, now);
        await checkAndSendRefillAlerts(profile.id);
      } catch (err) {
        console.error(`Failed to generate today's doses for profile ${profile.id}:`, err);
      }
    }

    // ── STEP 2: Process Medication Dose Reminders ─────────────────────────────
    // Fetch all DoseLogs from the last 2 hours up to next 15 minutes
    const windowStart = new Date(now.getTime() - TWO_HOURS_MS);
    const windowEnd = new Date(now.getTime() + 16 * 60 * 1000); // next 16 minutes

    const dosesInWindow = await prisma.doseLog.findMany({
      where: {
        scheduledAt: {
          gte: windowStart,
          lte: windowEnd,
        },
        status: { in: [DoseStatus.PENDING, DoseStatus.MISSED] },
      },
      include: {
        medication: true,
        profile: true,
      },
    });

    for (const dose of dosesInWindow) {
      const scheduledMs = dose.scheduledAt.getTime();
      const nowMs = now.getTime();
      const diffMinutes = Math.round((nowMs - scheduledMs) / (60 * 1000));
      // diffMinutes < 0 means future (e.g. -15 = in 15 mins)
      // diffMinutes > 0 means past (e.g. +30 = 30 mins ago)

      // ── Rule 2a: UPCOMING (15 minutes before scheduled time) ────────────────
      // Triggers when scheduled time is 0 to 15 minutes in the future,
      // OR within the catch-up window if server restarted and dose is still pending.
      if (dose.status === DoseStatus.PENDING && diffMinutes >= -15 && diffMinutes < 30) {
        if (dose.profile.elderEmail) {
          const message = getReminderText('DOSE_UPCOMING', (dose.profile as any).language, { name: dose.profile.name, medicine: dose.medication.name, dosage: dose.medication.dosage, instructions: dose.medication.instructions ? `Instructions: ${dose.medication.instructions}` : '' });
          await sendEmailWithDeduplication({
            profileId: dose.profileId,
            entityId: dose.id,
            entityType: 'DoseLog',
            reminderType: EmailReminderType.DOSE_UPCOMING,
            recipient: dose.profile.elderEmail,
            subject: message.subject,
            body: message.body,
          });
        }
      }

      // ── Rule 2b: MISSED (30 minutes after scheduled time) ───────────────────
      // If 30+ minutes past, still PENDING, mark MISSED and email Elder
      if (dose.status === DoseStatus.PENDING && diffMinutes >= 30 && diffMinutes <= 120) {
        // Update status to MISSED
        await prisma.doseLog.update({
          where: { id: dose.id },
          data: { status: DoseStatus.MISSED },
        });

        if (dose.profile.elderEmail) {
          const message = getReminderText('DOSE_MISSED', (dose.profile as any).language, { name: dose.profile.name, medicine: dose.medication.name, dosage: dose.medication.dosage, time: formatTime(dose.scheduledAt, dose.profile.timezone) });
          await sendEmailWithDeduplication({
            profileId: dose.profileId,
            entityId: dose.id,
            entityType: 'DoseLog',
            reminderType: EmailReminderType.DOSE_MISSED,
            recipient: dose.profile.elderEmail,
            subject: message.subject,
            body: message.body,
          });
        }
      }

      // ── Rule 2c: ESCALATION (60 minutes after scheduled time) ───────────────
      // If 60+ minutes past and status is MISSED, email Caretaker and Family
      if (dose.status === DoseStatus.MISSED && diffMinutes >= 60 && diffMinutes <= 120) {
        const escalationRecipients = [
          { email: dose.profile.caretakerEmail, roleLabel: 'Caretaker' },
          { email: dose.profile.familyEmail, roleLabel: 'Family Member' },
        ].filter((r) => Boolean(r.email));

        for (const recipient of escalationRecipients) {
          const message = getReminderText('DOSE_ESCALATION', (dose.profile as any).language, { name: dose.profile.name, medicine: dose.medication.name, dosage: dose.medication.dosage, time: formatTime(dose.scheduledAt, dose.profile.timezone) });
          await sendEmailWithDeduplication({
            profileId: dose.profileId,
            entityId: dose.id,
            entityType: 'DoseLog',
            reminderType: EmailReminderType.DOSE_ESCALATION,
            recipient: recipient.email!,
            subject: message.subject,
            body: message.body,
          });
        }
      }
    }

    // ── STEP 3: Process Appointment Reminders ─────────────────────────────────
    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.UPCOMING,
        scheduledAt: {
          gte: now,
          lte: new Date(now.getTime() + 26 * 60 * 60 * 1000), // Next 26 hours
        },
      },
      include: { profile: true },
    });

    for (const appt of upcomingAppointments) {
      const scheduledMs = appt.scheduledAt.getTime();
      const nowMs = now.getTime();
      const hoursUntil = (scheduledMs - nowMs) / (60 * 60 * 1000);

      const allRecipients = [
        appt.profile.elderEmail,
        appt.profile.caretakerEmail,
        appt.profile.familyEmail,
      ].filter((e): e is string => Boolean(e));

      // Day before reminder (23h to 25h ahead)
      if (hoursUntil >= 23 && hoursUntil <= 25) {
        for (const email of allRecipients) {
          const message = getReminderText('APPOINTMENT_DAY_BEFORE', (appt.profile as any).language, { name: appt.profile.name, appointment: appt.title, doctor: appt.doctorName || 'Not specified', location: appt.location || 'Not specified', time: formatLocalDateTime(appt.scheduledAt, appt.profile.timezone), notes: appt.notes ? `Notes: ${appt.notes}` : '' });
          await sendEmailWithDeduplication({
            profileId: appt.profileId,
            entityId: appt.id,
            entityType: 'Appointment',
            reminderType: EmailReminderType.APPOINTMENT_DAY_BEFORE,
            recipient: email,
            subject: message.subject,
            body: message.body,
          });
        }
      }

      // 2 hours before reminder (1h 50m to 2h 10m ahead)
      if (hoursUntil >= 1.83 && hoursUntil <= 2.17) {
        for (const email of allRecipients) {
          const message = getReminderText('APPOINTMENT_TWO_HOUR', (appt.profile as any).language, { name: appt.profile.name, appointment: appt.title, doctor: appt.doctorName || 'Not specified', location: appt.location || 'Not specified', time: formatTime(appt.scheduledAt, appt.profile.timezone) });
          await sendEmailWithDeduplication({
            profileId: appt.profileId,
            entityId: appt.id,
            entityType: 'Appointment',
            reminderType: EmailReminderType.APPOINTMENT_TWO_HOUR,
            recipient: email,
            subject: message.subject,
            body: message.body,
          });
        }
      }
    }
  } catch (err) {
    console.error('Error during reminder scheduler tick:', err);
  }
}

/**
 * When a dose that was MISSED is finally marked TAKEN,
 * send an "all-clear" email to everyone who received the escalation.
 */
export async function sendAllClearEmailsIfEligible(doseId: string): Promise<void> {
  const dose = await prisma.doseLog.findUnique({
    where: { id: doseId },
    include: { medication: true, profile: true },
  });

  if (!dose) return;

  // Find anyone who received the DOSE_ESCALATION for this dose
  const previousEscalations = await prisma.emailLog.findMany({
    where: {
      entityId: doseId,
      reminderType: EmailReminderType.DOSE_ESCALATION,
      status: 'SENT',
    },
  });

  if (previousEscalations.length === 0) {
    return;
  }

  for (const esc of previousEscalations) {
    const message = getReminderText('DOSE_ALL_CLEAR', (dose.profile as any).language, { name: dose.profile.name, medicine: dose.medication.name, dosage: dose.medication.dosage });
    await sendEmailWithDeduplication({
      profileId: dose.profileId,
      entityId: dose.id,
      entityType: 'DoseLog',
      reminderType: EmailReminderType.DOSE_ALL_CLEAR,
      recipient: esc.recipient,
      subject: message.subject,
      body: message.body,
    });
  }
}

/**
 * Send notification to Elder when a Caretaker proposes a new medicine or change
 */
export async function sendProposalNeedsApprovalEmail(
  profileId: string,
  entityId: string,
  medicineName: string,
): Promise<void> {
  const profile = await prisma.careProfile.findUnique({
    where: { id: profileId },
  });

  if (!profile || !profile.elderEmail) return;
  const message = getReminderText('PROPOSAL_NEEDS_APPROVAL', (profile as any).language, { name: profile.name, medicine: medicineName });

  await sendEmailWithDeduplication({
    profileId,
    entityId,
    entityType: 'MedicationChangeProposal',
    reminderType: EmailReminderType.PROPOSAL_NEEDS_APPROVAL,
    recipient: profile.elderEmail,
    subject: message.subject,
    body: message.body,
  });
}

function formatTime(d: Date, timeZone: string): string {
  return formatLocalTime(d, timeZone);
}

