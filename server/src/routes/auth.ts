import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { PrismaClient, Role } from '@prisma/client';
import { verifyPasscode } from '../utils/hash.js';
import { signToken } from '../utils/jwt.js';
import { checkRateLimit, recordFailedAttempt } from '../middleware/rateLimiter.js';

const router = Router();
const prisma = new PrismaClient();

const loginSchema = z.object({
  profileId: z.string().uuid('Invalid profile ID format.'),
  role: z.nativeEnum(Role, { errorMap: () => ({ message: 'Role must be ELDER, CARETAKER, or FAMILY.' }) }),
  passcode: z.string().min(4, 'Passcode must be at least 4 characters.').max(100),
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { profileId, role, passcode } = parsed.data;
  const ipAddress = (req.headers['x-forwarded-for'] as string) ?? req.socket.remoteAddress ?? 'unknown';

  // 1. Find profile
  const profile = await prisma.careProfile.findUnique({ where: { id: profileId } });
  if (!profile) {
    // Don't reveal whether profile exists — generic error
    res.status(401).json({ error: 'Incorrect profile ID or passcode. Please try again.' });
    return;
  }

  // 2. Check rate limit
  const rateLimit = await checkRateLimit(profileId, role, ipAddress);
  if (rateLimit.blocked) {
    res.status(429).json({
      error: `Too many incorrect attempts. Please wait ${rateLimit.retryAfterMinutes} minute${rateLimit.retryAfterMinutes === 1 ? '' : 's'} and try again.`,
    });
    return;
  }

  // 3. Get the right hash for the role
  const hashMap: Record<Role, string> = {
    ELDER: profile.elderPasscodeHash,
    CARETAKER: profile.caretakerPasscodeHash,
    FAMILY: profile.familyPasscodeHash,
  };

  const isValid = await verifyPasscode(passcode, hashMap[role]);

  if (!isValid) {
    await recordFailedAttempt(profileId, role, ipAddress);
    res.status(401).json({ error: 'Incorrect passcode. Please try again.' });
    return;
  }

  // 4. Sign JWT
  const token = signToken({ profileId, role });

  res.json({
    token,
    role,
    profileId,
    elderName: profile.name,
    timezone: profile.timezone,
  });
});

// POST /api/auth/verify  — lightweight token check (used by client on page load)
router.post('/verify', async (req: Request, res: Response) => {
  // The authenticate middleware is not used here intentionally;
  // the client calls this to restore session, we just verify the token is valid.
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ valid: false });
    return;
  }

  try {
    const { verifyToken } = await import('../utils/jwt.js');
    const payload = verifyToken(auth.slice(7));

    // Also confirm the profile still exists
    const profile = await prisma.careProfile.findUnique({
      where: { id: payload.profileId },
      select: { id: true, name: true, timezone: true },
    });

    if (!profile) {
      res.status(401).json({ valid: false });
      return;
    }

    res.json({ valid: true, profileId: payload.profileId, role: payload.role, elderName: profile.name, timezone: profile.timezone });
  } catch {
    res.status(401).json({ valid: false });
  }
});

export default router;

