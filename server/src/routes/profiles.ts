import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { hashPasscode } from '../utils/hash.js';
import { authenticate } from '../middleware/auth.js';
import { AuditActor } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const languageSchema = z.object({ language: z.enum(['ENGLISH', 'HINDI', 'KANNADA']) });

const createProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(100),
  elderPasscode: z.string().min(4, 'Elder passcode must be at least 4 characters.').max(100),
  caretakerPasscode: z.string().min(4, 'Caretaker passcode must be at least 4 characters.').max(100),
  familyPasscode: z.string().min(4, 'Family passcode must be at least 4 characters.').max(100),
  elderEmail: z.string().email().optional().or(z.literal('')),
  caretakerEmail: z.string().email().optional().or(z.literal('')),
  familyEmail: z.string().email().optional().or(z.literal('')),
  timezone: z.string().optional(),
});

// POST /api/profiles  — create a new care profile (public, no auth required)
router.post('/', async (req: Request, res: Response) => {
  const parsed = createProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const {
    name,
    elderPasscode,
    caretakerPasscode,
    familyPasscode,
    elderEmail,
    caretakerEmail,
    familyEmail,
    timezone,
  } = parsed.data;

  const [elderHash, caretakerHash, familyHash] = await Promise.all([
    hashPasscode(elderPasscode),
    hashPasscode(caretakerPasscode),
    hashPasscode(familyPasscode),
  ]);

  const profile = await prisma.careProfile.create({
    data: {
      name,
      elderPasscodeHash: elderHash,
      caretakerPasscodeHash: caretakerHash,
      familyPasscodeHash: familyHash,
      elderEmail: elderEmail || null,
      caretakerEmail: caretakerEmail || null,
      familyEmail: familyEmail || null,
      timezone: timezone ?? 'Asia/Kolkata',
    },
    select: { id: true, name: true, createdAt: true },
  });

  // Audit log entry
  await prisma.auditLog.create({
    data: {
      profileId: profile.id,
      actor: AuditActor.ELDER,
      action: 'PROFILE_CREATED',
      entityType: 'CareProfile',
      entityId: profile.id,
      after: { name, timezone },
    },
  });

  res.status(201).json({
    profileId: profile.id,
    name: profile.name,
    message: 'Profile created! Save your profile ID — you will need it to sign in.',
  });
});

// GET /api/profiles/me  — get current profile info (authenticated)
router.get('/me', authenticate, async (req: Request, res: Response) => {
  const { profileId, role } = req.user!;

  const profile = await prisma.careProfile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      name: true,
      timezone: true,
      elderEmail: true,
      caretakerEmail: true,
      familyEmail: true,
      createdAt: true,
    },
  });

  if (!profile) {
    res.status(404).json({ error: 'Profile not found.' });
    return;
  }

  // Family and caretaker see limited email info
  const responseData =
    role === 'ELDER'
      ? profile
      : { id: profile.id, name: profile.name, timezone: profile.timezone, createdAt: profile.createdAt };

  res.json({ ...responseData, role });
});

router.get('/me/language', authenticate, async (req: Request, res: Response) => {
  const profile = await prisma.careProfile.findUnique({ where: { id: req.user!.profileId }, select: { language: true } as any });
  if (!profile) return res.status(404).json({ error: 'Profile not found.' });
  return res.json({ language: (profile as any).language ?? 'ENGLISH' });
});

router.patch('/me/language', authenticate, async (req: Request, res: Response) => {
  if (req.user!.role !== 'ELDER') return res.status(403).json({ error: 'Only the elder can change reminder language.' });
  const parsed = languageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose English, Hindi, or Kannada.' });
  await prisma.careProfile.update({ where: { id: req.user!.profileId }, data: { language: parsed.data.language } as any });
  return res.json({ language: parsed.data.language });
});

export default router;

