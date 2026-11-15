import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { env } from '../config/env.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getCurrentTime,
  advanceVirtualClock,
  resetVirtualClock,
  getClockStatus,
} from '../utils/clock.js';
import { runReminderSchedulerTick } from '../services/reminderScheduler.js';

const router = Router();

// Endpoint to check if demo mode is enabled (public so UI knows whether to render demo widget)
router.get('/status', (_req: Request, res: Response) => {
  res.json(getClockStatus());
});

// All mutating demo clock endpoints require authentication + Elder role
router.use(authenticate);

router.get('/', (req: Request, res: Response) => {
  res.json(getClockStatus());
});

const advanceSchema = z.object({
  minutes: z.number().int().min(1).max(10080), // up to 7 days
});

router.post('/advance', requireRole(Role.ELDER), async (req: Request, res: Response) => {
  if (!env.DEMO_MODE) {
    res.status(403).json({ error: 'Demo mode is not enabled in environment configuration.' });
    return;
  }

  const parsed = advanceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const newVirtualTime = advanceVirtualClock(parsed.data.minutes);

  // Immediately run scheduler tick at the new virtual time to process any due reminders/escalations
  await runReminderSchedulerTick();

  res.json({
    message: `Advanced clock by ${parsed.data.minutes} minutes.`,
    ...getClockStatus(),
  });
});

router.post('/reset', requireRole(Role.ELDER), async (_req: Request, res: Response) => {
  if (!env.DEMO_MODE) {
    res.status(403).json({ error: 'Demo mode is not enabled.' });
    return;
  }

  resetVirtualClock();
  await runReminderSchedulerTick();

  res.json({
    message: 'Demo clock reset to real time.',
    ...getClockStatus(),
  });
});

export default router;
