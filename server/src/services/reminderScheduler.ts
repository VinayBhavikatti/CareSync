import { PrismaClient, DoseStatus, EmailReminderType, AppointmentStatus } from '@prisma/client';
import { getCurrentTime } from '../utils/clock.js';
import { ensureTodayDosesForProfile } from './doseGenerator.js';
import { sendEmailWithDeduplication } from './emailService.js';

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
          await sendEmailWithDeduplication({
            profileId: dose.profileId,
            entityId: dose.id,
            entityType: 'DoseLog',
            reminderType: EmailReminderType.DOSE_UPCOMING,
            recipient: dose.profile.elderEmail,
            subject: `⏰ Upcoming dose: ${dose.medication.name} (${dose.medication.dosage})`,
            body: `Hello ${dose.profile.name},\n\nIt is almost time for your scheduled medicine: ${dose.medication.name} (${dose.medication.dosage}).\n${dose.medication.instructions ? `Instructions: ${dose.medication.instructions}\n` : ''}\nPlease take it on time and mark "I took it" in your Kindred app.`,
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
          await sendEmailWithDeduplication({
            profileId: dose.profileId,
            entityId: dose.id,
            entityType: 'DoseLog',
            reminderType: EmailReminderType.DOSE_MISSED,
            recipient: dose.profile.elderEmail,
            subject: `⚠️ Missed medication alert: ${dose.medication.name}`,
            body: `Hello ${dose.profile.name},\n\nYou missed your ${dose.medication.name} (${dose.medication.dosage}) scheduled for ${formatTime(dose.scheduledAt)}.\n\nIf you have already taken it, please open Kindred and tap "I took it" so your caretakers are aware.`,
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
          await sendEmailWithDeduplication({
            profileId: dose.profileId,
            entityId: dose.id,
            entityType: 'DoseLog',
            reminderType: EmailReminderType.DOSE_ESCALATION,
            recipient: recipient.email!,
            subject: `🚨 Urgent: ${dose.profile.name} has not taken ${dose.medication.name}`,
            body: `Kindred Escalation Notice:\n\n${dose.profile.name} was scheduled to take ${dose.medication.name} (${dose.medication.dosage}) over 1 hour ago (scheduled at ${formatTime(dose.scheduledAt)}), and it has not been marked as taken.\n\nPlease check in with them to make sure they are okay.`,
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
          await sendEmailWithDeduplication({
            profileId: appt.profileId,
            entityId: appt.id,
            entityType: 'Appointment',
            reminderType: EmailReminderType.APPOINTMENT_DAY_BEFORE,
            recipient: email,
            subject: `📅 Tomorrow: Appointment with ${appt.doctorName || appt.title}`,
            body: `Reminder: ${appt.profile.name} has an upcoming appointment tomorrow:\n\nTitle: ${appt.title}\nDoctor: ${appt.doctorName || 'Not specified'}\nLocation: ${appt.location || 'Not specified'}\nTime: ${appt.scheduledAt.toLocaleString()}\n${appt.notes ? `Notes: ${appt.notes}\n` : ''}`,
          });
        }
      }

      // 2 hours before reminder (1h 50m to 2h 10m ahead)
      if (hoursUntil >= 1.83 && hoursUntil <= 2.17) {
        for (const email of allRecipients) {
          await sendEmailWithDeduplication({
            profileId: appt.profileId,
            entityId: appt.id,
            entityType: 'Appointment',
            reminderType: EmailReminderType.APPOINTMENT_TWO_HOUR,
            recipient: email,
            subject: `📅 In 2 hours: Appointment "${appt.title}"`,
            body: `Reminder: ${appt.profile.name}'s appointment is coming up in about 2 hours at ${formatTime(appt.scheduledAt)}.\n\nLocation: ${appt.location || 'Not specified'}\nDoctor: ${appt.doctorName || 'Not specified'}`,
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
    await sendEmailWithDeduplication({
      profileId: dose.profileId,
      entityId: dose.id,
      entityType: 'DoseLog',
      reminderType: EmailReminderType.DOSE_ALL_CLEAR,
      recipient: esc.recipient,
      subject: `✅ All Clear: ${dose.profile.name} took their ${dose.medication.name}`,
      body: `All Clear Update:\n\n${dose.profile.name} has now taken their dose of ${dose.medication.name} (${dose.medication.dosage}) which was previously overdue.\n\nEverything is up to date!`,
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

  await sendEmailWithDeduplication({
    profileId,
    entityId,
    entityType: 'MedicationChangeProposal',
    reminderType: EmailReminderType.PROPOSAL_NEEDS_APPROVAL,
    recipient: profile.elderEmail,
    subject: `🔔 Caretaker proposed medicine: ${medicineName} needs your approval`,
    body: `Hello ${profile.name},\n\nYour caretaker has proposed adding or updating the medication "${medicineName}".\n\nBecause you are at the centre of your own healthcare, this change will not be added to your schedule until you approve it.\n\nPlease open your Kindred app and check the "Awaiting approval" banner on your Medicines screen.`,
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

