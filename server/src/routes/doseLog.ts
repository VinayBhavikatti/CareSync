import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { PrismaClient, Role, DoseStatus, AuditActor } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createAuditEntry } from '../services/auditService.js';
import { ensureTodayDosesForProfile } from '../services/doseGenerator.js';
import { getCurrentTime } from '../utils/clock.js';
import { sendAllClearEmailsIfEligible } from '../services/reminderScheduler.js';
import { decodeMedicationTimes } from '../utils/medicationTimes.js';
import { localDateKey } from '../utils/timezone.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

// ── GET /api/doses/today ─────────────────────────────────────────────────────
// Generates or retrieves today's dose logs for all active medications
router.get('/today', async (req: Request, res: Response) => {
  const { profileId } = req.user!;
  const now = getCurrentTime();

  const profile = await prisma.careProfile.findUnique({
    where: { id: profileId },
    select: { timezone: true },
  });

  const tz = profile?.timezone || 'Asia/Kolkata';
  const dateStr = localDateKey(now, tz);

  const todayDoses = await ensureTodayDosesForProfile(profileId, now);

  // Also include info about whether reminders or escalations were sent
  const doseIds = todayDoses.map((d) => d.id);
  const emailLogs = await prisma.emailLog.findMany({
    where: {
      entityId: { in: doseIds },
      status: 'SENT',
    },
    select: {
      entityId: true,
      reminderType: true,
    },
  });

  const emailLogsByDoseId = new Map<string, string[]>();
  for (const log of emailLogs) {
    const list = emailLogsByDoseId.get(log.entityId) || [];
    list.push(log.reminderType);
    emailLogsByDoseId.set(log.entityId, list);
  }

  const enhancedDoses = todayDoses.map((d) => ({
    ...d,
    reminderTypesSent: emailLogsByDoseId.get(d.id) || [],
  }));

  res.json({
    date: dateStr,
    doses: enhancedDoses,
  });
});

const updateDoseStatusSchema = z.object({
  status: z.enum(['TAKEN', 'SKIPPED', 'PENDING']),
  note: z.string().max(255).optional().nullable(),
});

// ── POST /api/doses/:id/status ───────────────────────────────────────────────
// Mark a dose as TAKEN or SKIPPED. Elder & Caretaker only. Family is 403.
router.post('/:id/status', requireRole(Role.ELDER, Role.CARETAKER), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { profileId, role } = req.user!;

  const parsed = updateDoseStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { status: newStatus, note } = parsed.data;

  const dose = await prisma.doseLog.findFirst({
    where: { id, profileId },
    include: { medication: true },
  });

  if (!dose) {
    res.status(404).json({ error: 'Dose record not found.' });
    return;
  }

  const previousStatus = dose.status;

  // Handle stock adjustments:
  // If moving TO TAKEN from not TAKEN -> reduce stock
  // If moving FROM TAKEN to something else -> restore stock
  let stockDelta = 0;
  if (newStatus === DoseStatus.TAKEN && previousStatus !== DoseStatus.TAKEN) {
    stockDelta = -dose.medication.pillsPerDose;
  } else if (previousStatus === DoseStatus.TAKEN && newStatus !== DoseStatus.TAKEN) {
    stockDelta = dose.medication.pillsPerDose;
  }

  const [updatedDose, updatedMed] = await prisma.$transaction([
    prisma.doseLog.update({
      where: { id },
      data: {
        status: newStatus as DoseStatus,
        loggedAt: new Date(),
        loggedBy: role,
        note: note !== undefined ? note : dose.note,
      },
      include: {
        medication: true,
      },
    }),
    ...(stockDelta !== 0
      ? [
          prisma.medication.update({
            where: { id: dose.medicationId },
            data: {
              stockCount: {
                // Prevent negative stock
                increment: stockDelta,
              },
            },
          }),
        ]
      : []),
  ]);

  // Make sure stock doesn't drop below 0
  if (updatedMed && updatedMed.stockCount < 0) {
    await prisma.medication.update({
      where: { id: dose.medicationId },
      data: { stockCount: 0 },
    });
  }

  await createAuditEntry({
    profileId,
    actor: role as unknown as AuditActor,
    action: `DOSE_MARKED_${newStatus}`,
    entityType: 'DoseLog',
    entityId: id,
    before: { status: previousStatus, note: dose.note },
    after: { status: newStatus, note, stockDelta },
  });

  // If a previously missed dose is marked TAKEN, trigger all-clear email
  if (previousStatus === DoseStatus.MISSED && newStatus === DoseStatus.TAKEN) {
    sendAllClearEmailsIfEligible(id).catch((err) =>
      console.error('Failed to dispatch all-clear emails:', err),
    );
  }

  res.json({
    dose: { ...updatedDose, medication: { ...updatedDose.medication, times: decodeMedicationTimes(updatedDose.medication.times) } },
    remainingStock: updatedMed ? Math.max(0, updatedMed.stockCount) : dose.medication.stockCount,
    message: newStatus === 'TAKEN' ? 'Dose marked as taken! Well done.' : 'Dose marked as skipped.',
  });
});

export default router;
