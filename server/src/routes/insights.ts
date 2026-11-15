import { Router, type Request, type Response } from 'express';
import { PrismaClient, DoseStatus, AppointmentStatus } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import {
  calculateAdherence,
  detectAdherencePatterns,
  calculateRefillPredictions,
  checkAndSendRefillAlerts,
} from '../services/insightsService.js';
import { getCurrentTime } from '../utils/clock.js';
import { addLocalDays, endOfLocalDayUtc, localDateKey, startOfLocalDayUtc } from '../utils/timezone.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

// ── GET /api/insights/adherence ──────────────────────────────────────────────
router.get('/adherence', async (req: Request, res: Response) => {
  const { profileId } = req.user!;
  const requested = Number(req.query.days) || 7;
  if (requested !== 7 && requested !== 30) return res.status(400).json({ error: 'days must be 7 or 30.' });
  const days = requested;

  const stats = await calculateAdherence(profileId, days);
  res.json(stats);
});

// ── GET /api/insights/patterns ───────────────────────────────────────────────
router.get('/patterns', async (req: Request, res: Response) => {
  const { profileId } = req.user!;
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));

  const patterns = await detectAdherencePatterns(profileId, days);
  res.json({ patterns, analyzedDays: days });
});

// ── GET /api/insights/refills ────────────────────────────────────────────────
router.get('/refills', async (req: Request, res: Response) => {
  const { profileId } = req.user!;

  const refills = await calculateRefillPredictions(profileId);
  // Also check if any refill emails need to be sent
  checkAndSendRefillAlerts(profileId).catch((err) =>
    console.error('Refill alert check failed:', err),
  );

  res.json({ refills });
});

// ── GET /api/insights/doctor-summary ─────────────────────────────────────────
// Generates complete report data for the printable Doctor Summary page
router.get('/doctor-summary', async (req: Request, res: Response) => {
  const { profileId } = req.user!;
  const now = getCurrentTime();
  const timezoneProfile = await prisma.careProfile.findUnique({ where: { id: profileId }, select: { timezone: true } });
  const timeZone = timezoneProfile?.timezone || 'Asia/Kolkata';
  const todayKey = localDateKey(now, timeZone);
  const endKey = req.query.end ? String(req.query.end) : todayKey;
  const startKey = req.query.start ? String(req.query.start) : addLocalDays(todayKey, -29);
  const requestedEndDate = req.query.end ? endOfLocalDayUtc(endKey, timeZone) : now;
  const endDate = requestedEndDate > now ? now : requestedEndDate;
  const startDate = startOfLocalDayUtc(startKey, timeZone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey) || !/^\d{4}-\d{2}-\d{2}$/.test(endKey) || !Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || startDate > endDate || endDate > now) {
    return res.status(400).json({ error: 'Provide a valid date range ending today or earlier.' });
  }
  const days = Math.max(1, Math.round((Date.parse(`${endKey}T00:00:00Z`) - Date.parse(`${startKey}T00:00:00Z`)) / 86400000) + 1);

  const [profile, adherence, patterns, refills, missedDoses, upcomingAppointments] =
    await Promise.all([
      prisma.careProfile.findUnique({
        where: { id: profileId },
        select: { id: true, name: true, timezone: true, createdAt: true },
      }),
      calculateAdherence(profileId, days, { start: startDate, end: endDate }),
      detectAdherencePatterns(profileId, days, { start: startDate, end: endDate }),
      calculateRefillPredictions(profileId),
      prisma.doseLog.findMany({
        where: {
          profileId,
          scheduledAt: { gte: startDate, lte: endDate },
          status: DoseStatus.MISSED,
        },
        include: { medication: true },
        orderBy: { scheduledAt: 'desc' },
      }),
      prisma.appointment.findMany({
        where: {
          profileId,
          scheduledAt: { gte: now },
          status: AppointmentStatus.UPCOMING,
        },
        orderBy: { scheduledAt: 'asc' },
        take: 5,
      }),
    ]);

  res.json({
    profile,
    reportDate: now.toISOString(),
    daysAnalyzed: days,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    adherence,
    patterns,
    refills,
    missedDoses: missedDoses.map((d) => ({
      id: d.id,
      medicationName: d.medication.name,
      dosage: d.medication.dosage,
      scheduledAt: d.scheduledAt.toISOString(),
      note: d.note,
    })),
    upcomingAppointments: upcomingAppointments.map((a) => ({
      id: a.id,
      title: a.title,
      doctorName: a.doctorName,
      location: a.location,
      scheduledAt: a.scheduledAt.toISOString(),
      notes: a.notes,
    })),
  });
});

export default router;
