import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

// ── GET /api/email-logs ──────────────────────────────────────────────────────
// All roles can view email logs for transparency and peace of mind
router.get('/', async (req: Request, res: Response) => {
  const { profileId } = req.user!;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const page = Math.max(1, Number(req.query.page) || 1);
  const skip = (page - 1) * limit;

  const [total, logs] = await Promise.all([
    prisma.emailLog.count({ where: { profileId } }),
    prisma.emailLog.findMany({
      where: { profileId },
      orderBy: { sentAt: 'desc' },
      take: limit,
      skip,
    }),
  ]);

  res.json({
    logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

export default router;

