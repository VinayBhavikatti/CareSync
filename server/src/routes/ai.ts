import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.js';
import { extractPrescription, summarizeAdherence } from '../ai/aiService.js';
import { validatePrescriptionUpload } from '../ai/uploadValidation.js';

const router = Router();
router.use(authenticate);

router.post('/prescription-draft', requireRole(Role.ELDER, Role.CARETAKER), async (req: Request, res: Response) => {
  const parsed = z.object({ mimeType: z.string(), imageBase64: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Upload a JPG or PNG image up to 5 MB.' });
  const upload = validatePrescriptionUpload(parsed.data.mimeType, parsed.data.imageBase64);
  if (!upload.valid) return res.status(400).json({ error: 'Upload a valid JPG or PNG image up to 5 MB.' });
  // The image remains in request memory only and is never persisted.
  const result = await extractPrescription(parsed.data.imageBase64, upload.mimeType);
  return res.json(result);
});

const summarySchema = z.object({
  periodDays: z.number().int().min(1).max(90),
  adherencePercent: z.number().min(0).max(100),
  taken: z.number().int().nonnegative(),
  missed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  patterns: z.array(z.object({ type: z.enum(['TIME_OF_DAY', 'WEEKEND', 'LATENESS']), count: z.number().int().nonnegative(), total: z.number().int().nonnegative() })).max(12),
  refills: z.array(z.object({ status: z.enum(['WARNING', 'CRITICAL']), daysRemaining: z.number().int().nonnegative() })).max(30),
});

router.post('/adherence-summary', async (req: Request, res: Response) => {
  const parsed = summarySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Summary data is invalid.' });
  const data = parsed.data;
  const fallback = `For ${data.periodDays} days, recorded adherence was ${data.adherencePercent}%. ${data.taken} doses were taken, ${data.missed} missed, and ${data.skipped} skipped.`;
  const result = await summarizeAdherence(data, fallback);
  return res.json(result);
});

export default router;
